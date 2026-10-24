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

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Initialize session state when a new call starts
  useEffect(() => {
    if (!session) return;
    setCallType(session.callType);
    setIsCameraOn(session.callType === 'video');
    setCallStatus('ringing');
    setDurationSeconds(0);
    setIsMuted(false);
    setIsScreenSharing(false);
    setIsMinimized(false);

    // Auto-connect outgoing call after 1.2s so the user sees both ringing & live timer
    if (session.direction === 'outgoing') {
      const connectTimer = setTimeout(() => {
        setCallStatus('connected');
      }, 1200);
      return () => clearTimeout(connectTimer);
    }
  }, [session]);

  // Increment call timer when connected
  useEffect(() => {
    if (!session || callStatus !== 'connected') return;
    const interval = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [session, callStatus]);

  // Manage optional hardware camera stream when video is enabled
  useEffect(() => {
    let cancelled = false;
    async function syncCamera() {
      if (!session || !isCameraOn) {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        setHasHardwareCamera(false);
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          mediaStreamRef.current = stream;
          setHasHardwareCamera(true);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch {
          setHasHardwareCamera(false);
        }
      }
    }

    syncCamera();

    return () => {
      cancelled = true;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [session, isCameraOn]);

  if (!session) return null;

  const handleToggleCamera = () => {
    const nextCamera = !isCameraOn;
    setIsCameraOn(nextCamera);
    setCallType(nextCamera ? 'video' : 'audio');
  };

  const handleHangup = () => {
    const finalStatus: CallStatus =
      callStatus === 'connected' ? 'ended' : session.direction === 'incoming' ? 'missed' : 'ended';
    onEndCall(durationSeconds, callType, finalStatus);
  };

  // Floating minimized call bar
  if (isMinimized) {
    return (
      <div
        role="region"
        aria-label="Minimized active call"
        className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-80 rounded-2xl border border-[#00a884] bg-white text-black p-3.5 shadow-2xl flex items-center justify-between gap-3"
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
            className="p-2 rounded-xl bg-[#f0f2f5] hover:bg-[#d9fdd3] text-black cursor-pointer border border-[#d1d7db]"
          >
            <Maximize2 className="w-4 h-4 text-black" />
          </button>
          <button
            type="button"
            aria-label="End call"
            onClick={handleHangup}
            className="p-2 rounded-xl bg-red-300 hover:bg-red-400 text-black cursor-pointer border border-red-500"
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
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="relative max-w-2xl w-full rounded-3xl border border-[#d1d7db] bg-[#efeae2] text-black overflow-hidden shadow-2xl flex flex-col justify-between min-h-[540px]">
        {/* WhatsApp Daylight Ambiance Backdrop */}
        <div className="absolute inset-0 wa-chat-wallpaper opacity-95 pointer-events-none" />

        {/* Video Stream Backdrop when Video Call is active */}
        {isCameraOn && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={createStoryVisualSvg('studio', session.peerName)}
              alt="Remote video stream"
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-white/75" />
          </div>
        )}

        {/* Top Call Header Bar */}
        <div className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-[#d1d7db] bg-white/95 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-black">
            <Lock className="w-3.5 h-3.5 text-black" />
            <span>ConnectX Protected {callType === 'video' ? 'HD Video' : 'Voice'} Call</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Minimize call window"
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl bg-[#f0f2f5] hover:bg-[#d9fdd3] text-black transition-colors cursor-pointer border border-[#d1d7db]"
              title="Minimize to floating bar"
            >
              <Minimize2 className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>

        {/* Center Call Stage: Peer Profile / Video Canvas */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5">
          <div className="relative">
            <div className="p-1.5 rounded-full border-2 border-[#00a884] bg-white shadow-md">
              <img
                src={session.peerAvatar}
                alt={session.peerName}
                className="w-28 h-28 rounded-full object-cover"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <h2
              id="active-call-peer-name"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-black"
            >
              {session.peerName}
            </h2>
            <p className="text-xs font-mono font-semibold text-black">@{session.peerUsername}</p>
            <div className="pt-1 flex items-center justify-center gap-2 text-sm font-bold text-black tabular-nums">
              {callStatus === 'ringing' ? (
                <span>
                  {session.direction === 'incoming'
                    ? 'Incoming ConnectX Call...'
                    : 'Ringing...'}
                </span>
              ) : (
                <span>{formatCallDuration(durationSeconds)}</span>
              )}
              <span aria-hidden="true" className="text-black">
                ·
              </span>
              <span className="text-xs font-semibold text-black">
                {isMuted ? 'Mic Muted' : isScreenSharing ? 'Sharing Screen' : 'Crystal Clear Audio'}
              </span>
            </div>
          </div>

          {/* Equalizer / Audio Ambiance Bars */}
          {callStatus === 'connected' && (
            <div className="flex items-center justify-center gap-1.5 h-8 px-4 py-1.5 rounded-xl bg-white border border-[#d1d7db] shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-black mr-1" />
              <span className="text-xs text-black font-semibold">
                {isMuted
                  ? 'Your microphone is muted'
                  : `Connected with ${session.peerName}`}
              </span>
            </div>
          )}

          {/* Local Picture-in-Picture Self Preview when Video or Screen Share is active */}
          {(isCameraOn || isScreenSharing) && (
            <div className="sm:absolute sm:bottom-6 sm:right-6 w-40 h-28 rounded-2xl overflow-hidden border-2 border-[#00a884] bg-white shadow-xl flex flex-col justify-between p-2.5 text-left">
              {hasHardwareCamera && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-50"
                />
              )}
              <div className="relative z-10 flex items-center gap-2">
                <img
                  src={currentUserAvatar}
                  alt={currentUserName}
                  className="w-7 h-7 rounded-full object-cover border border-[#d1d7db]"
                />
                <span className="text-[11px] font-bold text-black truncate">
                  You ({isScreenSharing ? 'Screen' : 'Camera'})
                </span>
              </div>
              <div className="relative z-10 text-[10px] text-black font-mono font-semibold">
                1080p · Live Preview
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Dock */}
        <div className="relative z-10 px-6 py-5 bg-white border-t border-[#d1d7db] flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {callStatus === 'ringing' && session.direction === 'incoming' ? (
            <>
              <button
                type="button"
                onClick={() => setCallStatus('connected')}
                className="px-6 py-3 rounded-2xl bg-[#25d366] hover:bg-[#1da851] text-black text-sm font-bold flex items-center gap-2 cursor-pointer border border-[#1da851]"
              >
                <Phone className="w-4 h-4 text-black" />
                <span>Answer Call</span>
              </button>
              <button
                type="button"
                onClick={handleHangup}
                className="px-6 py-3 rounded-2xl bg-red-300 hover:bg-red-400 text-black text-sm font-bold flex items-center gap-2 cursor-pointer border border-red-500"
              >
                <PhoneOff className="w-4 h-4 text-black" />
                <span>Decline</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                onClick={() => setIsMuted((m) => !m)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border ${
                  isMuted
                    ? 'bg-amber-200 border-amber-500 text-black'
                    : 'bg-[#f0f2f5] hover:bg-[#e2e6ea] border-[#d1d7db] text-black'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4 text-black" /> : <Mic className="w-4 h-4 text-black" />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                type="button"
                aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                onClick={handleToggleCamera}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border ${
                  isCameraOn
                    ? 'bg-[#d9fdd3] border-[#00a884] text-black'
                    : 'bg-[#f0f2f5] hover:bg-[#e2e6ea] border-[#d1d7db] text-black'
                }`}
              >
                {isCameraOn ? <Video className="w-4 h-4 text-black" /> : <VideoOff className="w-4 h-4 text-black" />}
                <span>{isCameraOn ? 'Video On' : 'Video Off'}</span>
              </button>

              <button
                type="button"
                aria-label={isSpeakerOn ? 'Disable speakerphone' : 'Enable speakerphone'}
                onClick={() => setIsSpeakerOn((s) => !s)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border ${
                  isSpeakerOn
                    ? 'bg-[#f0f2f5] hover:bg-[#e2e6ea] border-[#d1d7db] text-black'
                    : 'bg-white border-[#d1d7db] text-black'
                }`}
              >
                {isSpeakerOn ? <Volume2 className="w-4 h-4 text-black" /> : <VolumeX className="w-4 h-4 text-black" />}
                <span>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
              </button>

              <button
                type="button"
                aria-label={isScreenSharing ? 'Stop screen share' : 'Share screen'}
                onClick={() => setIsScreenSharing((s) => !s)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border ${
                  isScreenSharing
                    ? 'bg-[#d9fdd3] border-[#00a884] text-black'
                    : 'bg-[#f0f2f5] hover:bg-[#e2e6ea] border-[#d1d7db] text-black'
                }`}
              >
                <MonitorUp className="w-4 h-4 text-black" />
                <span>{isScreenSharing ? 'Sharing' : 'Share Screen'}</span>
              </button>

              <button
                type="button"
                aria-label="End call"
                onClick={handleHangup}
                className="px-5 py-3 rounded-2xl bg-red-300 hover:bg-red-400 text-black text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-red-500"
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
