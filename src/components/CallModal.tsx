import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Lock,
  Minimize2,
  Maximize2,
  Sparkles,
  FlipHorizontal,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { CallStatus, CallType } from '../types/connectx';
import { formatCallDuration } from '../utils/connectxRules';
import {
  acquireDeviceMedia,
  initiateOutgoingCall,
  answerIncomingCall,
  rejectIncomingCall,
  endCall,
  ActiveWebRTCConnection,
} from '../services/webRTCService';

export interface ActiveCallSession {
  callId: string;
  chatId: string;
  peerUid: string;
  peerName: string;
  peerUsername: string;
  peerAvatar: string;
  callType: CallType;
  direction: 'outgoing' | 'incoming';
  currentUserId?: string;
  currentUserUsername?: string;
}

interface CallModalProps {
  session: ActiveCallSession | null;
  currentUserName: string;
  currentUserAvatar: string;
  onEndCall: (durationSeconds: number, finalCallType: CallType, finalStatus: CallStatus) => void;
}

// Synthesize telephone ringing feedback using universal Web Audio API (works offline, in PWA and native Android WebView)
function startRingtoneSynth(): () => void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return () => {};
    const ctx = new AudioCtx();
    let isCancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const playRingBurst = () => {
      if (isCancelled || ctx.state === 'closed') return;
      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Standard telephony dual tones: 440Hz + 480Hz
        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.8);
        osc2.stop(now + 1.8);
      } catch {
        // Audio burst handled
      }
    };

    playRingBurst();
    intervalId = setInterval(playRingBurst, 3500);

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
      try {
        ctx.close().catch(() => {});
      } catch {
        // Context closed
      }
    };
  } catch {
    return () => {};
  }
}

// Synthesize a pleasant connection chime when call transitions to connected
function playConnectedChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Chime handled
  }
}

export const CallModal: React.FC<CallModalProps> = ({
  session,
  currentUserName,
  currentUserAvatar,
  onEndCall,
}) => {
  const [callStatus, setCallStatus] = useState<CallStatus>('ringing');
  const [callType, setCallType] = useState<CallType>('audio');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const activeConnRef = useRef<ActiveWebRTCConnection | null>(null);
  const stopRingRef = useRef<(() => void) | null>(null);

  // Initialize session state and handle WebRTC setup
  useEffect(() => {
    if (!session) return;

    setCallType(session.callType);
    setIsCameraOn(session.callType === 'video');
    setCallStatus('ringing');
    setDurationSeconds(0);
    setIsMuted(false);
    setIsMinimized(false);
    setPermissionError(null);
    setHasRemoteVideo(false);

    // Start synthesized ringing tone
    stopRingRef.current = startRingtoneSynth();

    let isCancelled = false;

    // If Outgoing: Acquire media and initiate WebRTC offer immediately
    if (session.direction === 'outgoing') {
      acquireDeviceMedia(session.callType, cameraFacing)
        .then(async (stream) => {
          if (isCancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          localStreamRef.current = stream;
          if (localVideoRef.current && session.callType === 'video') {
            localVideoRef.current.srcObject = stream;
          }

          try {
            const conn = await initiateOutgoingCall(
              {
                callId: session.callId,
                chatId: session.chatId,
                callerUid: session.currentUserId || 'unknown',
                callerName: currentUserName,
                callerUsername: session.currentUserUsername || 'user',
                callerAvatar: currentUserAvatar,
                calleeUid: session.peerUid,
                calleeName: session.peerName,
                calleeUsername: session.peerUsername,
                calleeAvatar: session.peerAvatar,
                callType: session.callType,
              },
              stream,
              (remoteStream) => {
                remoteStreamRef.current = remoteStream;
                if (remoteAudioRef.current) {
                  remoteAudioRef.current.srcObject = remoteStream;
                }
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                  const vTracks = remoteStream.getVideoTracks();
                  setHasRemoteVideo(vTracks.length > 0);
                }
              },
              (newStatus) => {
                setCallStatus(newStatus);
                if (newStatus === 'connected') {
                  if (stopRingRef.current) {
                    stopRingRef.current();
                    stopRingRef.current = null;
                  }
                  playConnectedChime();
                } else if (newStatus === 'ended' || newStatus === 'rejected' || newStatus === 'busy' || newStatus === 'missed') {
                  handleHangup(newStatus);
                }
              },
              (errMsg) => setPermissionError(errMsg)
            );

            activeConnRef.current = conn;
          } catch (initErr: unknown) {
            console.warn('Outgoing WebRTC call error:', initErr);
            setPermissionError('Unable to connect call. Please verify device permissions and network.');
          }
        })
        .catch((mediaErr) => {
          console.warn('Hardware media acquisition error:', mediaErr);
          setPermissionError('Microphone or camera permission denied. Please allow access in device settings.');
        });
    }

    return () => {
      isCancelled = true;
      if (stopRingRef.current) {
        stopRingRef.current();
        stopRingRef.current = null;
      }
      if (activeConnRef.current) {
        activeConnRef.current.cleanup().catch(() => {});
        activeConnRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [session]);

  // Duration timer for active calls
  useEffect(() => {
    if (!session || callStatus !== 'connected') return;
    const interval = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [session, callStatus]);

  // Handle Callee Answering Incoming Call
  const handleAnswerCall = async () => {
    if (!session) return;
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }

    try {
      const stream = await acquireDeviceMedia(session.callType, cameraFacing);
      localStreamRef.current = stream;
      if (localVideoRef.current && session.callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const conn = await answerIncomingCall(
        session.callId,
        stream,
        (remoteStream) => {
          remoteStreamRef.current = remoteStream;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            const vTracks = remoteStream.getVideoTracks();
            setHasRemoteVideo(vTracks.length > 0);
          }
        },
        (newStatus) => {
          setCallStatus(newStatus);
          if (newStatus === 'ended') {
            handleHangup('ended');
          }
        },
        (errMsg) => setPermissionError(errMsg)
      );

      activeConnRef.current = conn;
      playConnectedChime();
      setCallStatus('connected');
    } catch (err: unknown) {
      console.warn('Failed to answer incoming call:', err);
      setPermissionError('Could not access microphone/camera to answer call.');
    }
  };

  // Handle Callee Rejecting Call
  const handleRejectCall = async () => {
    if (!session) return;
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }
    await rejectIncomingCall(session.callId, 'rejected');
    onEndCall(0, callType, 'rejected');
  };

  // Handle Hanging Up
  const handleHangup = async (overrideStatus?: CallStatus) => {
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }

    if (activeConnRef.current) {
      await activeConnRef.current.cleanup().catch(() => {});
      activeConnRef.current = null;
    }

    if (session) {
      await endCall(session.callId).catch(() => {});
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    const finalStatus: CallStatus =
      overrideStatus || (callStatus === 'connected' ? 'ended' : session?.direction === 'incoming' ? 'missed' : 'ended');
    onEndCall(durationSeconds, callType, finalStatus);
  };

  // Hardware Controls: Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
  };

  // Hardware Controls: Camera On / Off
  const handleToggleCamera = () => {
    const nextCamera = !isCameraOn;
    setIsCameraOn(nextCamera);
    setCallType(nextCamera ? 'video' : 'audio');
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = nextCamera;
      });
    }
  };

  // Hardware Controls: Flip Camera
  const handleFlipCamera = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);

    if (localStreamRef.current && isCameraOn) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 1280 } },
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack && activeConnRef.current) {
          const senders = activeConnRef.current.peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = newStream;
          }
        }
      } catch (err) {
        console.warn('Failed to flip camera:', err);
      }
    }
  };

  // Hardware Controls: Speaker Volume
  const handleToggleSpeaker = () => {
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !nextSpeaker;
    }
  };

  if (!session) return null;

  // Minimized floating call widget
  if (isMinimized) {
    return (
      <div
        role="region"
        aria-label="Minimized active call"
        className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-80 rounded-2xl border-2 border-[#008C5A] bg-white text-black p-3.5 shadow-2xl flex items-center justify-between gap-3 animate-fade-in"
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={session.peerAvatar}
            alt={session.peerName}
            className="w-10 h-10 rounded-full object-cover border-2 border-[#008C5A]"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold text-black truncate">{session.peerName}</div>
            <div className="text-xs text-black font-mono font-semibold tabular-nums">
              {callStatus === 'connected' ? formatCallDuration(durationSeconds) : 'Connecting WebRTC...'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label="Expand call window"
            onClick={() => setIsMinimized(false)}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-black cursor-pointer border border-slate-300 transition-colors"
          >
            <Maximize2 className="w-4 h-4 text-black" />
          </button>
          <button
            type="button"
            aria-label="End call"
            onClick={() => handleHangup()}
            className="p-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white cursor-pointer transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-call-peer-name"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in"
    >
      {/* Hidden real remote audio element */}
      <audio ref={remoteAudioRef} autoPlay />

      <div className="relative max-w-2xl w-full rounded-3xl border border-slate-700 bg-[#0f172a] text-white overflow-hidden shadow-2xl flex flex-col justify-between min-h-[520px] max-h-[92vh]">
        {/* Full-screen Remote Video Stage when Video Call is connected */}
        {callType === 'video' && callStatus === 'connected' && (
          <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`}
            />
            {!hasRemoteVideo && (
              <div className="text-center p-6 space-y-2">
                <img
                  src={session.peerAvatar}
                  alt={session.peerName}
                  className="w-24 h-24 rounded-full mx-auto border-4 border-[#008C5A]"
                />
                <p className="text-sm font-bold text-slate-300">Awaiting peer video feed...</p>
              </div>
            )}
          </div>
        )}

        {/* Top Call Header Bar */}
        <div className="relative z-10 px-5 sm:px-6 py-3.5 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <ShieldCheck className="w-4 h-4 text-[#45D69A]" />
            <span>ConnectX WebRTC {callType === 'video' ? 'HD Video' : 'Voice'} Call</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Minimize call window"
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Minimize to floating widget"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Permission Warning Banner if hardware access is blocked */}
        {permissionError && (
          <div className="relative z-10 px-4 py-2.5 bg-amber-500/20 border-b border-amber-500/30 text-xs text-amber-200 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1">{permissionError}</span>
            <button
              type="button"
              onClick={() => setPermissionError(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Center Call Stage */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          {!(callType === 'video' && callStatus === 'connected' && hasRemoteVideo) && (
            <div className="relative">
              <div className="p-1.5 rounded-full border-4 border-[#008C5A] bg-slate-900 shadow-2xl">
                <img
                  src={session.peerAvatar}
                  alt={session.peerName}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover"
                />
              </div>
              {callStatus === 'connected' && (
                <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[#45D69A] border-2 border-slate-900 shadow-xs animate-pulse" />
              )}
            </div>
          )}

          <div className="space-y-1">
            <h2
              id="active-call-peer-name"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-md"
            >
              {session.peerName}
            </h2>
            <p className="text-xs font-mono font-semibold text-slate-300">@{session.peerUsername}</p>
            <div className="pt-1 flex items-center justify-center gap-2 text-sm font-bold text-white tabular-nums">
              {callStatus === 'ringing' ? (
                <span className="text-[#45D69A] animate-pulse">
                  {session.direction === 'incoming'
                    ? 'Incoming ConnectX Call...'
                    : 'Ringing peer...'}
                </span>
              ) : (
                <span className="text-white drop-shadow-sm">{formatCallDuration(durationSeconds)}</span>
              )}
              <span aria-hidden="true">·</span>
              <span className="text-xs font-semibold text-slate-300">
                {isMuted ? 'Muted' : 'Direct WebRTC Stream'}
              </span>
            </div>
          </div>

          {/* Connected audio badge */}
          {callStatus === 'connected' && (
            <div className="flex items-center justify-center gap-1.5 h-8 px-4 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#45D69A] mr-1" />
              <span className="text-xs text-white font-semibold">
                {isMuted ? 'Microphone muted' : 'WebRTC PeerConnection Active'}
              </span>
            </div>
          )}

          {/* Local Picture-in-Picture Self Preview */}
          {isCameraOn && (
            <div className="sm:absolute sm:bottom-6 sm:right-6 w-36 h-28 rounded-2xl overflow-hidden border-2 border-[#008C5A] bg-black shadow-2xl flex flex-col justify-between p-2.5 text-left relative z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="relative z-10 flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded-md text-white backdrop-blur-xs">
                <img
                  src={currentUserAvatar}
                  alt={currentUserName}
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-[10px] font-bold truncate">
                  You ({cameraFacing === 'user' ? 'Front' : 'Rear'})
                </span>
              </div>
              <div className="relative z-10 text-[9px] text-[#45D69A] bg-black/60 px-1.5 py-0.5 rounded-md self-start font-mono font-semibold">
                Local Feed
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Dock */}
        <div className="relative z-10 px-4 sm:px-6 py-4 sm:py-5 bg-black/50 backdrop-blur-lg border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
          {callStatus === 'ringing' && session.direction === 'incoming' ? (
            /* Incoming Call Prompt: Accept or Reject */
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={handleRejectCall}
                className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <PhoneOff className="w-5 h-5" />
                <span>Decline</span>
              </button>
              <button
                type="button"
                onClick={handleAnswerCall}
                className="px-6 py-3.5 rounded-2xl bg-[#008C5A] hover:bg-[#006B46] text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer animate-bounce"
              >
                <Phone className="w-5 h-5" />
                <span>Accept Call</span>
              </button>
            </div>
          ) : (
            /* Active Call Controls */
            <>
              {/* Mic Toggle */}
              <button
                type="button"
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                onClick={handleToggleMute}
                className={`p-3.5 rounded-2xl font-bold transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-rose-500/20 border border-rose-500 text-rose-300'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Camera Toggle */}
              <button
                type="button"
                aria-label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
                onClick={handleToggleCamera}
                className={`p-3.5 rounded-2xl font-bold transition-all cursor-pointer ${
                  isCameraOn
                    ? 'bg-[#008C5A] text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              {/* Flip Camera (if camera on) */}
              {isCameraOn && (
                <button
                  type="button"
                  aria-label="Switch camera"
                  onClick={handleFlipCamera}
                  className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all cursor-pointer"
                  title="Switch Front/Rear Camera"
                >
                  <FlipHorizontal className="w-5 h-5" />
                </button>
              )}

              {/* Speaker Output Toggle */}
              <button
                type="button"
                aria-label={isSpeakerOn ? 'Mute speaker' : 'Enable speaker'}
                onClick={handleToggleSpeaker}
                className={`p-3.5 rounded-2xl font-bold transition-all cursor-pointer ${
                  isSpeakerOn
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-rose-500/20 border border-rose-500 text-rose-300'
                }`}
                title={isSpeakerOn ? 'Speaker On' : 'Speaker Muted'}
              >
                {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              {/* End Call Button */}
              <button
                type="button"
                aria-label="Hang up call"
                onClick={() => handleHangup()}
                className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ml-2"
              >
                <PhoneOff className="w-5 h-5" />
                <span>End Call</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
