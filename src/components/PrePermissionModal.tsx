import React from 'react';
import { Bell, Shield, PhoneCall, MessageCircle, X } from 'lucide-react';
import { getPlatformInfo } from '../services/notificationService';

interface PrePermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

export const PrePermissionModal: React.FC<PrePermissionModalProps> = ({
  isOpen,
  onAllow,
  onDismiss,
}) => {
  if (!isOpen) return null;

  const platformInfo = getPlatformInfo();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200">
        <div className="relative p-6 text-center bg-gradient-to-b from-emerald-50 to-white">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close permission dialog"
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-[#005c4b] to-[#25d366] text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Bell className="w-8 h-8" />
          </div>

          <h3 id="perm-modal-title" className="text-xl font-bold text-slate-900 tracking-tight">
            Stay Connected in Real-Time
          </h3>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Turn on notifications so you never miss a direct message or an incoming voice or video call
            from your friends.
          </p>
        </div>

        <div className="px-6 py-4 space-y-3.5">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="p-2 rounded-xl bg-emerald-100 text-[#005c4b] shrink-0 mt-0.5">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Instant Message Alerts</h4>
              <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                Know immediately when a friend sends you a message or photo.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0 mt-0.5">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Voice & Video Calls</h4>
              <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                Receive incoming ring notifications even when your phone is locked or app is in background.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Your Privacy is Protected</h4>
              <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                You can hide message previews from your lock screen and mute specific chats anytime.
              </p>
            </div>
          </div>

          {platformInfo.isIOS && !platformInfo.isIOSPWA && (
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
              <strong>Tip for iPhone users:</strong> Tap the Share button in Safari and choose{' '}
              <span className="font-semibold">&quot;Add to Home Screen&quot;</span> to unlock Web Push alerts on iOS 16.4+.
            </div>
          )}
        </div>

        <div className="p-6 pt-2 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onAllow}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-[#25d366] hover:bg-[#1ebe5d] text-black shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span>Enable Notifications</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer text-center"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
