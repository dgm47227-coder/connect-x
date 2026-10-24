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
  MonitorUp,
  Lock,
  Minimize2,
  Maximize2,
  Sparkles,
  FlipHorizontal,
  AlertCircle,
} from 'lucide-react';
import { CallStatus, CallType } from '../types/connectx';
import { formatCallDuration } from '../utils/connectxRules';
import { createStoryVisualSvg } from '../utils/seedData';

export interface ActiveCallSession {
  callId: string;
  chatId: string;
  peerUid: string;
  peerName: string;
  peerUsername: string;
  peerAvatar: string;
  callType: CallType;
  direction: 'outgoing' | 'incoming';
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasHardwareCamera, setHasHardwareCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const stopRingRef = useRef<(() => void) | null>(null);

  // Initialize session state and handle ringing tone
  useEffect(() => {
    if (!session) return;
    setCallType(session.callType);
    setIsCameraOn(session.callType === 'video');
    setCallStatus('ringing');
    setDurationSeconds(0);
    setIsMuted(false);
    setIsScreenSharing(false);
    setIsMinimized(false);
    setPermissionError(null);

    // Start synthesized ringing tone
    stopRingRef.current = startRingtoneSynth();

    // Auto-connect outgoing calls after 1.5s for seamless peer experience
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    if (session.direction === 'outgoing') {
      connectTimer = setTimeout(() => {
        setCallStatus('connected');
        if (stopRingRef.current) {
          stopRingRef.current();
          stopRingRef.current = null;
        }
        playConnectedChime();
      }, 1500);
    }

    return () => {
      if (connectTimer) clearTimeout(connectTimer);
      if (stopRingRef.current) {
        stopRingRef.current();
        stopRingRef.current = null;
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

  // Hardware Media Stream Management (Voice mic + Video camera)
  useEffect(() => {
    if (!session) return;
    let isCancelled = false;

    async function acquireMedia() {
      // Clean up previous tracks before acquiring new stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return;
      }

      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isCameraOn ? { facingMode: cameraFacing } : false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        setPermissionError(null);

        // Apply mute status to audio tracks
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !isMuted;
        });

        // Attach video track if camera is enabled
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0 && isCameraOn) {
          setHasHardwareCamera(true);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } else {
          setHasHardwareCamera(false);
        }
      } catch (err: unknown) {
        const errObj = err as { name?: string };
        if (errObj.name === 'NotAllowedError' || errObj.name === 'PermissionDeniedError') {
          setPermissionError(
            'Microphone or camera permission was denied. Please allow access in your browser or device settings.'
          );
        } else if (errObj.name === 'NotFoundError') {
          setPermissionError('No camera or microphone hardware found on this device.');
        } else {
          // Hardware stream optional in emulator environments
          setHasHardwareCamera(false);
        }
      }
    }

    acquireMedia();

    return () => {
      isCancelled = true;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [session, isCameraOn, cameraFacing]);

  // Sync mute state to audio tracks
  useEffect(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  if (!session) return null;

  const handleToggleCamera = () => {
    const nextCamera = !isCameraOn;
    setIsCameraOn(nextCamera);
    setCallType(nextCamera ? 'video' : 'audio');
  };

  const handleFlipCamera = () => {
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleHangup = () => {
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    const finalStatus: CallStatus =
      callStatus === 'connected' ? 'ended' : session.direction === 'incoming' ? 'missed' : 'ended';
    onEndCall(durationSeconds, callType, finalStatus);
  };

  const handleAnswerCall = () => {
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }
    playConnectedChime();
    setCallStatus('connected');
  };

  // Minimized floating call widget
  if (isMinimized) {
    return (
      <div
        role="region"
        aria-label="Minimized active call"
        className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-80 rounded-2xl border-2 border-[#00a884] bg-white text-black p-3.5 shadow-2xl flex items-center justify-between gap-3 animate-fade-in"
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={session.peerAvatar}
            alt={session.peerName}
            className="w-10 h-10 rounded-full object-cover border border-[#00a884]"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold text-black truncate">{session.peerName}</div>
            <div className="text-xs text-black font-mono font-semibold tabular-nums">
              {callStatus === 'connected' ? formatCallDuration(durationSeconds) : 'Ringing...'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label="Expand call window"
            onClick={() => setIsMinimized(false)}
            className="p-2.5 rounded-xl bg-[#f0f2f5] hover:bg-[#d9fdd3] text-black cursor-pointer border border-[#d1d7db] transition-colors"
          >
            <Maximize2 className="w-4 h-4 text-black" />
          </button>
          <button
            type="button"
            aria-label="End call"
            onClick={handleHangup}
            className="p-2.5 rounded-xl bg-red-300 hover:bg-red-400 text-black cursor-pointer border border-red-500 transition-colors"
          >
            <PhoneOff className="w-4 h-4 text-black" />
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in"
    >
      <div className="relative max-w-2xl w-full rounded-3xl border border-[#d1d7db] bg-[#efeae2] text-black overflow-hidden shadow-2xl flex flex-col justify-between min-h-[520px] max-h-[92vh]">
        {/* WhatsApp Chat Ambiance Wallpaper */}
        <div className="absolute inset-0 wa-chat-wallpaper opacity-95 pointer-events-none" />

        {/* Video Stream Stage when Video is enabled */}
        {isCameraOn && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={createStoryVisualSvg('studio', session.peerName)}
              alt="Remote video stream"
              className="w-full h-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-white/70" />
          </div>
        )}

        {/* Top Call Header Bar */}
        <div className="relative z-10 px-5 sm:px-6 py-3.5 flex items-center justify-between border-b border-[#d1d7db] bg-white/95 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-black">
            <Lock className="w-3.5 h-3.5 text-[#00a884]" />
            <span>ConnectX Protected {callType === 'video' ? 'HD Video' : 'Voice'} Call</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Minimize call window"
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl bg-[#f0f2f5] hover:bg-[#d9fdd3] text-black transition-colors cursor-pointer border border-[#d1d7db]"
              title="Minimize to floating widget"
            >
              <Minimize2 className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>

        {/* Permission Warning Banner if hardware access is blocked */}
        {permissionError && (
          <div className="relative z-10 px-4 py-2.5 bg-amber-100 border-b border-amber-300 text-xs text-black font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
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
          <div className="relative">
            <div className="p-1.5 rounded-full border-4 border-[#00a884] bg-white shadow-lg">
              <img
                src={session.peerAvatar}
                alt={session.peerName}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover"
              />
            </div>
            {callStatus === 'connected' && (
              <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[#25d366] border-2 border-white shadow-xs animate-pulse" />
            )}
          </div>

          <div className="space-y-1">
            <h2
              id="active-call-peer-name"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-black"
            >
              {session.peerName}
            </h2>
            <p className="text-xs font-mono font-semibold text-black">@{session.peerUsername}</p>
            <div className="pt-1 flex items-center justify-center gap-2 text-sm font-bold text-black tabular-nums">
              {callStatus === 'ringing' ? (
                <span className="text-[#00a884] animate-pulse">
                  {session.direction === 'incoming'
                    ? 'Incoming ConnectX Call...'
                    : 'Ringing...'}
                </span>
              ) : (
                <span className="text-black">{formatCallDuration(durationSeconds)}</span>
              )}
              <span aria-hidden="true" className="text-black">
                ·
              </span>
              <span className="text-xs font-semibold text-black">
                {isMuted ? 'Mic Muted' : isScreenSharing ? 'Sharing Screen' : 'Crystal Clear Audio'}
              </span>
            </div>
          </div>

          {/* Equalizer / Audio Active Indicator */}
          {callStatus === 'connected' && (
            <div className="flex items-center justify-center gap-1.5 h-8 px-4 py-1.5 rounded-xl bg-white border border-[#d1d7db] shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#00a884] mr-1" />
              <span className="text-xs text-black font-semibold">
                {isMuted
                  ? 'Your microphone is muted'
                  : `Active ${callType === 'video' ? 'Video' : 'Voice'} Session`}
              </span>
            </div>
          )}

          {/* Local Picture-in-Picture Self Preview */}
          {(isCameraOn || isScreenSharing) && (
            <div className="sm:absolute sm:bottom-6 sm:right-6 w-36 h-28 rounded-2xl overflow-hidden border-2 border-[#00a884] bg-white shadow-xl flex flex-col justify-between p-2.5 text-left relative">
              {hasHardwareCamera && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="relative z-10 flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-md text-white backdrop-blur-xs">
                <img
                  src={currentUserAvatar}
                  alt={currentUserName}
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-[10px] font-bold truncate">
                  You ({cameraFacing === 'user' ? 'Front' : 'Rear'})
                </span>
              </div>
              <div className="relative z-10 text-[9px] text-white bg-black/40 px-1.5 py-0.5 rounded-md self-start font-mono font-semibold">
                Live Preview
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Dock */}
        <div className="relative z-10 px-4 sm:px-6 py-4 sm:py-5 bg-white border-t border-[#d1d7db] flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {callStatus === 'ringing' && session.direction === 'incoming' ? (
            <>
              <button
                type="button"
                onClick={handleAnswerCall}
                className="px-6 py-3 rounded-2xl bg-[#25d366] hover:bg-[#1da851] text-black text-sm font-bold flex items-center gap-2 cursor-pointer border border-[#1da851] shadow-xs min-h-[44px]"
              >
                <Phone className="w-4 h-4 text-black" />
                <span>Answer Call</span>
              </button>
              <button
                type="button"
                onClick={handleHangup}
                className="px-6 py-3 rounded-2xl bg-red-300 hover:bg-red-400 text-black text-sm font-bold flex items-center gap-2 cursor-pointer border border-red-500 shadow-xs min-h-[44px]"
              >
                <PhoneOff className="w-4 h-4 text-black" />
                <span>Decline</span>
              </button>
            </>
          ) : (
            <>
              {/* Mute Button */}
              <button
                type="button"
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                onClick={() => setIsMuted((m) => !m)}
                className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border min-h-[44px] ${
                  isMuted
                    ? 'bg-amber-200 border-amber-500 text-black shadow-inner'
                    : 'bg-[#f0f2f5] hover:bg-[#e2e6ea] border-[#d1d7db] text-black shadow-xs'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4 text-black" /> : <Mic className="w-4 h-4 text-black" />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              {/* Camera Toggle Button */}
              <button
                type="button"
                aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                onClick={handleToggleCamera}
                className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border min-h-[44px] ${
                  isCameraOn
                    ? 'bg-[#d9fdd3] border-[#00a884] text-black shadow-inner'
                    : 'bg-[#f0f2f5] hover:bg-[#e2e6ea] border-[#d1d7db] text-black shadow-xs'
                }`}
              >
                {isCameraOn ? <Video className="w-4 h-4 text-black" /> : <VideoOff className="w-4 h-4 text-black" />}
                <span>{isCameraOn ? 'Video On' : 'Video Off'}</span>
              </button>

              {/* Flip Camera Button (when camera is on) */}
              {isCameraOn && (
                <button
                  type="button"
                  aria-label="Switch between front and back camera"
                  onClick={handleFlipCamera}
                  className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-xs font-bold flex items-center gap-2 bg-[#f0f2f5] hover:bg-[#e2e6ea] border border-[#d1d7db] text-black transition-all cursor-pointer min-h-[44px]"
                  title="Switch front/rear camera"
                >
                  <FlipHorizontal className="w-4 h-4 text-black" />
                  <span>Flip</span>
                </button>
              )}

              {/* Speaker Toggle Button */}
              <button
                type="button"
                aria-label={isSpeakerOn ? 'Disable speakerphone' : 'Enable speakerphone'}
                onClick={() => setIsSpeakerOn((s) => !s)}
                className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border min-h-[44px] ${
                  isSpeakerOn
                    ? 'bg-[#f0f2f5] hover:bg-[#e2e6ea] border-[#d1d7db] text-black shadow-xs'
                    : 'bg-white border-[#d1d7db] text-black shadow-xs'
                }`}
              >
                {isSpeakerOn ? <Volume2 className="w-4 h-4 text-black" /> : <VolumeX className="w-4 h-4 text-black" />}
                <span>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
              </button>

              {/* Screen Share Button */}
              <button
                type="button"
                aria-label={isScreenSharing ? 'Stop screen share' : 'Share screen'}
                onClick={() => setIsScreenSharing((s) => !s)}
                className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border min-h-[44px] ${
                  isScreenSharing
                    ? 'bg-[#d9fdd3] border-[#00a884] text-black shadow-inner'
                    : 'bg-[#f0f2f5] hover:bg-[#e2e6ea] border-[#d1d7db] text-black shadow-xs'
                }`}
              >
                <MonitorUp className="w-4 h-4 text-black" />
                <span>{isScreenSharing ? 'Sharing' : 'Share Screen'}</span>
              </button>

              {/* End Call Button */}
              <button
                type="button"
                aria-label="End call"
                onClick={handleHangup}
                className="px-5 py-3 rounded-2xl bg-red-300 hover:bg-red-400 text-black text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-red-500 shadow-xs min-h-[44px] active:scale-95"
              >
                <PhoneOff className="w-4 h-4 text-black" />
                <span>End Call</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
