import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  MessageSquare,
  Phone,
  PhoneMissed,
  Video,
  UserPlus,
  ShieldAlert,
  Eye,
  CheckCircle2,
  Database,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { UserNotification, UserPrivateSettings } from '../types/connectx';
import { formatNotificationBody, formatNotificationTitle } from '../utils/connectxRules';
import { getNotificationPermissionStatus } from '../services/notificationService';

interface NotificationCenterProps {
  isOpen: boolean;
  notifications: UserNotification[];
  privateSettings: UserPrivateSettings;
  onClose: () => void;
  onNavigateToTarget: (notification: UserNotification) => void;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (notificationId: string) => void;
  onClearReadNotifications: () => void;
  onOpenSettings: () => void;
  onOpenPermissionPrompt: () => void;
}

type FilterTab = 'all' | 'unread' | 'calls' | 'messages' | 'friends';

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  notifications,
  privateSettings,
  onClose,
  onNavigateToTarget,
  onMarkAllAsRead,
  onMarkAsRead,
  onClearReadNotifications,
  onOpenSettings,
  onOpenPermissionPrompt,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');

  if (!isOpen) return null;

  const permStatus = getNotificationPermissionStatus();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'calls') {
      return (
        n.type === 'incoming_call' ||
        n.type === 'incoming_video_call' ||
        n.type === 'missed_call'
      );
    }
    if (filter === 'messages') return n.type === 'new_message';
    if (filter === 'friends') {
      return n.type === 'friend_request' || n.type === 'friend_accepted';
    }
    return true;
  });

  const getNotificationIcon = (type: UserNotification['type']) => {
    switch (type) {
      case 'incoming_call':
        return <Phone className="w-4 h-4 text-emerald-600" />;
      case 'incoming_video_call':
        return <Video className="w-4 h-4 text-emerald-600" />;
      case 'missed_call':
        return <PhoneMissed className="w-4 h-4 text-rose-500" />;
      case 'new_message':
        return <MessageSquare className="w-4 h-4 text-emerald-600" />;
      case 'friend_request':
      case 'friend_accepted':
        return <UserPlus className="w-4 h-4 text-blue-600" />;
      case 'security_alert':
        return <ShieldAlert className="w-4 h-4 text-amber-500" />;
      case 'story_view':
        return <Eye className="w-4 h-4 text-indigo-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-center-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
    >
      <div className="max-w-md w-full h-full bg-white border-l border-slate-200 text-slate-800 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#25d366]/20 text-[#005c4b]">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 id="notif-center-title" className="text-base font-bold text-slate-900">
                  Notification Center
                </h2>
                <p className="text-[11px] text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Notification Settings"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close notification center"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread ${unreadCount > 0 ? `(${unreadCount})` : ''}` },
                { id: 'messages', label: 'Messages' },
                { id: 'calls', label: 'Calls' },
                { id: 'friends', label: 'Friends' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filter === tab.id
                    ? 'bg-[#25d366] text-black font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Center Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* Permission Prompt Banner if default */}
          {permStatus === 'default' && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-between gap-3 text-emerald-950">
              <div className="text-xs">
                <span className="font-bold">Enable Push Notifications</span>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Get ring tones and messages in the background.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenPermissionPrompt}
                className="px-3 py-1.5 rounded-xl bg-[#25d366] hover:bg-[#1ebe5d] text-black text-xs font-bold shrink-0 cursor-pointer shadow-xs"
              >
                Enable
              </button>
            </div>
          )}

          {/* System Diagnostic Status Badges */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-[#d9fdd3] border border-emerald-400 text-black flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
              <span className="truncate font-medium">PWA & SW Active</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 shrink-0 text-slate-600" />
              <span className="truncate font-medium">Firestore Live Sync</span>
            </div>
          </div>

          {/* Notification List */}
          {filteredNotifications.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-700">No notifications found</h4>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                {filter === 'unread'
                  ? 'You have read all your notifications!'
                  : 'New messages, calls, and friend requests from real users will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notif) => {
                const title = formatNotificationTitle(notif);
                const body = formatNotificationBody(
                  notif,
                  privateSettings.notificationPreviewEnabled
                );

                return (
                  <div
                    key={notif.notificationId}
                    onClick={() => {
                      if (!notif.isRead) onMarkAsRead(notif.notificationId);
                      onNavigateToTarget(notif);
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      notif.isRead
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400 shadow-xs'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        notif.isRead ? 'bg-slate-100' : 'bg-emerald-100'
                      }`}
                    >
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-900 truncate">{title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                        {body}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px]">
                        <span className="font-mono text-slate-400">@{notif.actorUsername}</span>
                        {!notif.isRead && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[9px]">
                            New
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="self-center text-slate-300 hover:text-slate-500">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Mark all read</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClearReadNotifications}
              disabled={notifications.length === 0}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear read</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-800 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
