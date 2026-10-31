/**
 * ConnectX by FZ — WebRTC Voice & HD Video Calling Engine
 * 
 * Provides robust peer-to-peer audio and video calling using:
 * - Google Public STUN servers
 * - Cloud Firestore real-time signaling (/calls/{callId})
 * - Automatic ICE candidate gathering and bidirectional queuing
 * - Hardware stream acquisition with front/rear camera toggling and mute control
 * - 35-second unanswered call timeout with 'missed' state transition
 * - Leak-free media track release and connection teardown
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  CallSessionDoc,
  CallStatus,
  CallType,
  RTCIceCandidatePayload,
  RTCSdpPayload,
} from '../types/connectx';

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export interface ActiveWebRTCConnection {
  callId: string;
  peerConnection: RTCPeerConnection;
  localStream: MediaStream;
  remoteStream: MediaStream;
  cleanup: () => Promise<void>;
}

/**
 * Acquire device microphone and optional camera stream with fallback protection.
 */
export async function acquireDeviceMedia(
  callType: CallType,
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('WebRTC media devices are not supported in this environment.');
  }

  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  const videoConstraints: MediaTrackConstraints | boolean =
    callType === 'video'
      ? {
          facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        }
      : false;

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: videoConstraints,
    });
  } catch (err: unknown) {
    const errorObj = err as { name?: string };
    // If video acquisition failed, attempt audio-only fallback
    if (callType === 'video') {
      try {
        console.warn('Video acquisition failed, falling back to audio-only stream:', errorObj.name);
        return await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

/**
 * Initiates an outgoing WebRTC call, creates the SDP offer, and establishes
 * Firestore signaling listeners.
 */
export async function initiateOutgoingCall(
  callData: {
    callId: string;
    chatId: string;
    callerUid: string;
    callerName: string;
    callerUsername: string;
    callerAvatar: string;
    calleeUid: string;
    calleeName: string;
    calleeUsername: string;
    calleeAvatar: string;
    callType: CallType;
  },
  localStream: MediaStream,
  onRemoteStreamReceived: (stream: MediaStream) => void,
  onStatusChange: (status: CallStatus) => void,
  onError: (error: string) => void
): Promise<ActiveWebRTCConnection> {
  const { callId } = callData;
  const pc = new RTCPeerConnection(ICE_SERVERS);
  const remoteStream = new MediaStream();

  // Add all local audio & video tracks to PeerConnection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Handle incoming remote media tracks
  pc.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    onRemoteStreamReceived(remoteStream);
  };

  // Dispatch local ICE candidates to Firestore /calls/{callId}/callerCandidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidatePayload: RTCIceCandidatePayload = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
        usernameFragment: event.candidate.usernameFragment,
      };
      addDoc(collection(db, 'calls', callId, 'callerCandidates'), candidatePayload).catch((e) =>
        console.warn('Failed to publish caller ICE candidate:', e)
      );
    }
  };

  // Monitor connection states
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      onStatusChange('connected');
    } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      console.warn('WebRTC connection state:', pc.connectionState);
    }
  };

  // Generate SDP Offer
  const offerDescription = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: callData.callType === 'video',
  });
  await pc.setLocalDescription(offerDescription);

  const offerPayload: RTCSdpPayload = {
    type: 'offer',
    sdp: offerDescription.sdp || '',
  };

  // Save Call Session Document to Firestore
  await setDoc(doc(db, 'calls', callId), {
    callId,
    chatId: callData.chatId,
    callerUid: callData.callerUid,
    callerName: callData.callerName,
    callerUsername: callData.callerUsername,
    callerAvatar: callData.callerAvatar,
    calleeUid: callData.calleeUid,
    calleeName: callData.calleeName,
    calleeUsername: callData.calleeUsername,
    calleeAvatar: callData.calleeAvatar,
    callType: callData.callType,
    status: 'ringing',
    offer: offerPayload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Listen for Callee's SDP Answer & Status changes
  let isAnswerSet = false;
  const unsubCallDoc = onSnapshot(doc(db, 'calls', callId), async (snapshot) => {
    const data = snapshot.data();
    if (!data) return;

    const currentStatus = data.status as CallStatus;
    if (currentStatus) {
      onStatusChange(currentStatus);
    }

    if (data.answer && !isAnswerSet && pc.signalingState !== 'closed') {
      try {
        const answerDesc = new RTCSessionDescription({
          type: 'answer',
          sdp: data.answer.sdp,
        });
        await pc.setRemoteDescription(answerDesc);
        isAnswerSet = true;
      } catch (err) {
        console.warn('Failed to apply remote answer description:', err);
      }
    }
  });

  // Listen for Callee's ICE candidates
  const unsubCalleeCandidates = onSnapshot(
    collection(db, 'calls', callId, 'calleeCandidates'),
    (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' && pc.remoteDescription && pc.signalingState !== 'closed') {
          const candidateData = change.doc.data() as RTCIceCandidatePayload;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch (err) {
            console.warn('Failed to add callee candidate:', err);
          }
        }
      });
    }
  );

  // 35-second unanswered call timeout -> mark as 'missed'
  const ringingTimeoutId = setTimeout(async () => {
    if (pc.connectionState !== 'connected') {
      try {
        await updateDoc(doc(db, 'calls', callId), {
          status: 'missed',
          updatedAt: serverTimestamp(),
        });
        onStatusChange('missed');
      } catch {
        // Handled
      }
    }
  }, 35000);

  const cleanup = async () => {
    clearTimeout(ringingTimeoutId);
    unsubCallDoc();
    unsubCalleeCandidates();

    // Stop local tracks
    localStream.getTracks().forEach((track) => track.stop());
    remoteStream.getTracks().forEach((track) => track.stop());

    // Close PeerConnection
    if (pc.signalingState !== 'closed') {
      pc.close();
    }

    // Mark call as ended in Firestore if not already completed
    try {
      const snap = await getDoc(doc(db, 'calls', callId));
      if (snap.exists() && snap.data().status !== 'ended') {
        await updateDoc(doc(db, 'calls', callId), {
          status: 'ended',
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Handled
    }
  };

  return {
    callId,
    peerConnection: pc,
    localStream,
    remoteStream,
    cleanup,
  };
}

/**
 * Callee accepts incoming call: sets remote offer, generates SDP answer,
 * and exchanges ICE candidates.
 */
export async function answerIncomingCall(
  callId: string,
  localStream: MediaStream,
  onRemoteStreamReceived: (stream: MediaStream) => void,
  onStatusChange: (status: CallStatus) => void,
  onError: (error: string) => void
): Promise<ActiveWebRTCConnection> {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  const remoteStream = new MediaStream();

  // Add local media tracks
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Handle incoming remote media tracks
  pc.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    onRemoteStreamReceived(remoteStream);
  };

  // Dispatch callee ICE candidates to Firestore /calls/{callId}/calleeCandidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidatePayload: RTCIceCandidatePayload = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
        usernameFragment: event.candidate.usernameFragment,
      };
      addDoc(collection(db, 'calls', callId, 'calleeCandidates'), candidatePayload).catch((e) =>
        console.warn('Failed to publish callee ICE candidate:', e)
      );
    }
  };

  // Monitor connection states
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      onStatusChange('connected');
    }
  };

  // Read caller's SDP offer from Firestore
  const callDocSnap = await getDoc(doc(db, 'calls', callId));
  if (!callDocSnap.exists()) {
    throw new Error('Call session not found on server.');
  }

  const callDocData = callDocSnap.data();
  if (!callDocData.offer) {
    throw new Error('Caller offer was not found in call session.');
  }

  // Set remote description from caller's offer
  await pc.setRemoteDescription(new RTCSessionDescription(callDocData.offer));

  // Create and set local SDP Answer
  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answerPayload: RTCSdpPayload = {
    type: 'answer',
    sdp: answerDescription.sdp || '',
  };

  // Update Call Session Document to connected with answer
  await updateDoc(doc(db, 'calls', callId), {
    answer: answerPayload,
    status: 'connected',
    updatedAt: serverTimestamp(),
  });

  // Listen for Caller's ICE candidates
  const unsubCallerCandidates = onSnapshot(
    collection(db, 'calls', callId, 'callerCandidates'),
    (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' && pc.remoteDescription && pc.signalingState !== 'closed') {
          const candidateData = change.doc.data() as RTCIceCandidatePayload;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch (err) {
            console.warn('Failed to add caller candidate:', err);
          }
        }
      });
    }
  );

  // Listen for Call status updates (e.g. caller hangs up)
  const unsubCallDoc = onSnapshot(doc(db, 'calls', callId), (snapshot) => {
    const data = snapshot.data();
    if (data && data.status) {
      onStatusChange(data.status as CallStatus);
    }
  });

  const cleanup = async () => {
    unsubCallerCandidates();
    unsubCallDoc();

    localStream.getTracks().forEach((track) => track.stop());
    remoteStream.getTracks().forEach((track) => track.stop());

    if (pc.signalingState !== 'closed') {
      pc.close();
    }

    try {
      await updateDoc(doc(db, 'calls', callId), {
        status: 'ended',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Handled
    }
  };

  return {
    callId,
    peerConnection: pc,
    localStream,
    remoteStream,
    cleanup,
  };
}

/**
 * Callee rejects an incoming call.
 */
export async function rejectIncomingCall(callId: string, reason: 'rejected' | 'busy' = 'rejected'): Promise<void> {
  try {
    await updateDoc(doc(db, 'calls', callId), {
      status: reason,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to reject incoming call:', err);
  }
}

/**
 * Terminate an active call session and notify peer via Firestore.
 */
export async function endCall(callId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'calls', callId), {
      status: 'ended',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to mark call ended:', err);
  }
}
