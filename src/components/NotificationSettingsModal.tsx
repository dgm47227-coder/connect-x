import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  Volume2,
  Vibrate,
  Shield,
  MessageCircle,
  PhoneCall,
  UserCheck,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  VolumeX,
} from 'lucide-react';
import { ChatConversation, UserPrivateSettings } from '../types/connectx';
import {
  getNotificationPermissionStatus,
  getPlatformInfo,
  playNotificationChime,
  requestNotificationPermission,
  vibrateDevice,
} from '../services/notificationService';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  currentUserId: string;
  privateSettings: UserPrivateSettings;
  chats: ChatConversation[];
  onUpdatePrivateSettings: (updated: Partial<UserPrivateSettings>) => void;
  onUnmuteChat: (chatId: string) => void;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  currentUserId,
  privateSettings,
  chats,
  onUpdatePrivateSettings,
  onUnmuteChat,
  onClose,
}) => {
  const [permStatus, setPermStatus] = useState(() => getNotificationPermissionStatus());
  const [testingChime, setTestingChime] = useState(false);
  const [testingVibe, setTestingVibe] = useState(false);

  if (!isOpen) return null;

  const platformInfo = getPlatformInfo();

  const handleRequestSysPerm = async () => {
    const status = await requestNotificationPermission();
    setPermStatus(status);
  };

  const handleTestChime = () => {
    setTestingChime(true);
    playNotificationChime(false);
    setTimeout(() => setTestingChime(false), 800);
  };

  const handleTestCallChime = () => {
    setTestingChime(true);
    playNotificationChime(true);
    setTimeout(() => setTestingChime(false), 800);
  };

  const handleTestVibrate = () => {
    setTestingVibe(true);
    vibrateDevice([150, 100, 150]);
    setTimeout(() => setTestingVibe(false), 800);
  };

  // Find muted chats details
  const mutedIds = privateSettings.mutedChatIds || [];
  const mutedChatList = chats.filter((c) => mutedIds.includes(c.chatId));

  const isMasterEnabled = privateSettings.notificationsEnabled !== false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-settings-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#25d366]/20 text-[#005c4b]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 id="notif-settings-title" className="text-base font-bold text-slate-900">
                Notification Preferences
              </h3>
              <p className="text-[11px] text-slate-500">
                Manage alerts, sounds, vibrations, and chat mutes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* System Permission Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
              permStatus === 'granted'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : permStatus === 'denied'
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {permStatus === 'granted' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : permStatus === 'denied' ? (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              ) : (
                <Info className="w-5 h-5 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-bold">
                {permStatus === 'granted'
                  ? 'System Notifications Allowed'
                  : permStatus === 'denied'
                  ? 'System Notifications Blocked'
                  : 'Push Permission Pending'}
              </div>
              <p className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                {permStatus === 'granted'
                  ? 'Your browser/device allows ConnectX to send push alerts in the background.'
                  : permStatus === 'denied'
                  ? 'Operating system or browser permissions are currently blocked. To receive alerts when the app is closed, please unblock ConnectX in browser or Android App Info permissions.'
                  : 'Grant system permission to receive messages and call rings even when the app is minimized.'}
              </p>

              {permStatus === 'default' && (
                <button
                  type="button"
                  onClick={handleRequestSysPerm}
                  className="mt-2.5 px-3 py-1.5 rounded-lg bg-[#25d366] hover:bg-[#1ebe5d] text-black font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Request System Permission
                </button>
              )}
            </div>
          </div>

          {/* Master Toggle */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">Enable All Notifications</div>
              <div className="text-[11px] text-slate-500">
                Master switch to enable or pause all incoming push and in-app alerts.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isMasterEnabled}
                onChange={(e) => onUpdatePrivateSettings({ notificationsEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25d366]" />
            </label>
          </div>

          {/* Categories */}
          <div className={`space-y-3 ${!isMasterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Notification Channels
            </h4>

            {/* Direct Messages */}
            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Direct Messages</div>
                  <div className="text-[11px] text-slate-500">
                    Alerts for new messages and chat photos
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={privateSettings.notifyMessages}
                onChange={(e) => onUpdatePrivateSettings({ notifyMessages: e.target.checked })}
                className="w-4 h-4 accent-[#25d366] cursor-pointer"
              />
            </label>

            {/* Voice & Video Calls */}
            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Voice & Video Calls</div>
                  <div className="text-[11px] text-slate-500">
                    Incoming call rings and missed call notifications
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={privateSettings.notifyCalls !== false}
                onChange={(e) => onUpdatePrivateSettings({ notifyCalls: e.target.checked })}
                className="w-4 h-4 accent-[#25d366] cursor-pointer"
              />
            </label>

            {/* Friend Requests */}
            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-50 text-violet-700">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Friend Requests & Accepts</div>
                  <div className="text-[11px] text-slate-500">
                    When someone sends or accepts a friend connection
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={privateSettings.notifyFriendRequests}
                onChange={(e) =>
                  onUpdatePrivateSettings({ notifyFriendRequests: e.target.checked })
                }
                className="w-4 h-4 accent-[#25d366] cursor-pointer"
              />
            </label>

            {/* Stories */}
            <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Story Updates & Views</div>
                  <div className="text-[11px] text-slate-500">
                    When friends post new stories or view your updates
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={privateSettings.notifyStories}
                onChange={(e) => onUpdatePrivateSettings({ notifyStories: e.target.checked })}
                className="w-4 h-4 accent-[#25d366] cursor-pointer"
              />
            </label>
          </div>

          {/* Sound & Vibration Feedback */}
          <div className={`space-y-3 ${!isMasterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Sounds & Haptics
            </h4>

            {/* Sound Toggle & Test */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">In-App Sound Chimes</div>
                  <div className="text-[11px] text-slate-500">
                    Play pleasant audio chime on incoming messages & calls
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestChime}
                  disabled={testingChime}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  {testingChime ? 'Playing...' : 'Test Bubble'}
                </button>
                <button
                  type="button"
                  onClick={handleTestCallChime}
                  disabled={testingChime}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  {testingChime ? 'Playing...' : 'Test Ring'}
                </button>
                <input
                  type="checkbox"
                  checked={privateSettings.notifySound !== false}
                  onChange={(e) => onUpdatePrivateSettings({ notifySound: e.target.checked })}
                  className="w-4 h-4 accent-[#25d366] cursor-pointer"
                />
              </div>
            </div>

            {/* Vibration Toggle & Test */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Vibrate className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Vibration Feedback</div>
                  <div className="text-[11px] text-slate-500">
                    Gentle haptic pulses on Android and supported mobile devices
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestVibrate}
                  disabled={testingVibe}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  {testingVibe ? 'Buzzing...' : 'Test Vibrate'}
                </button>
                <input
                  type="checkbox"
                  checked={privateSettings.notifyVibrate !== false}
                  onChange={(e) => onUpdatePrivateSettings({ notifyVibrate: e.target.checked })}
                  className="w-4 h-4 accent-[#25d366] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Privacy & Lock Screen */}
          <div className={`space-y-3 ${!isMasterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Privacy & Lock Screen
            </h4>

            <label className="flex items-start justify-between p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors cursor-pointer gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700 mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Show Message Previews</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    When enabled, notification previews show sender name and message content. When
                    disabled, notifications show a generic &quot;You have a new message&quot; to prevent
                    sensitive content from showing on locked screens.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={privateSettings.notificationPreviewEnabled}
                onChange={(e) =>
                  onUpdatePrivateSettings({ notificationPreviewEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-[#25d366] cursor-pointer mt-1"
              />
            </label>
          </div>

          {/* Muted Chats Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Muted Chats ({mutedChatList.length})
              </h4>
            </div>

            {mutedChatList.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-[11px]">
                No muted chats. You can mute individual conversations from within the chat header.
              </div>
            ) : (
              <div className="space-y-2">
                {mutedChatList.map((chat) => {
                  const peerName =
                    chat.participant1Uid === currentUserId
                      ? chat.participant2Name
                      : chat.participant1Name;
                  const peerUsername =
                    chat.participant1Uid === currentUserId
                      ? chat.participant2Username
                      : chat.participant1Username;

                  return (
                    <div
                      key={chat.chatId}
                      className="p-3 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                          <VolumeX className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-slate-900 truncate">{peerName}</div>
                          <div className="text-[10px] text-slate-500 truncate">@{peerUsername}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onUnmuteChat(chat.chatId)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                      >
                        Unmute
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-black font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
