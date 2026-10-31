import React, { useEffect } from 'react';
import {
  MessageSquare,
  Phone,
  PhoneMissed,
  Video,
  UserPlus,
  ShieldAlert,
  X,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { UserNotification, UserPrivateSettings } from '../types/connectx';
import { formatNotificationBody, formatNotificationTitle } from '../utils/connectxRules';

interface InAppNotificationBannerProps {
  notification: UserNotification | null;
  privateSettings: UserPrivateSettings;
  onNavigate: (notification: UserNotification) => void;
  onDismiss: () => void;
}

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  notification,
  privateSettings,
  onNavigate,
  onDismiss,
}) => {
  useEffect(() => {
    if (!notification) return;
    // Auto dismiss after 6 seconds
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const isPreview = privateSettings.notificationPreviewEnabled;
  const title = formatNotificationTitle(notification);
  const body = formatNotificationBody(notification, isPreview);

  const getIcon = () => {
    switch (notification.type) {
      case 'incoming_call':
        return <Phone className="w-5 h-5 text-emerald-600 animate-pulse" />;
      case 'incoming_video_call':
        return <Video className="w-5 h-5 text-emerald-600 animate-pulse" />;
      case 'missed_call':
        return <PhoneMissed className="w-5 h-5 text-rose-500" />;
      case 'new_message':
        return <MessageSquare className="w-5 h-5 text-emerald-600" />;
      case 'friend_request':
      case 'friend_accepted':
        return <UserPlus className="w-5 h-5 text-blue-600" />;
      case 'security_alert':
        return <ShieldAlert className="w-5 h-5 text-amber-500" />;
      case 'story_view':
        return <Eye className="w-5 h-5 text-indigo-500" />;
      default:
        return <MessageSquare className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl p-3.5 flex items-start gap-3 text-slate-800 transition-all hover:shadow-2xl">
        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 shrink-0">
          {getIcon()}
        </div>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => {
            onNavigate(notification);
            onDismiss();
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-bold text-slate-900 truncate">{title}</h4>
            <span className="text-[10px] text-slate-400 font-medium shrink-0">Just now</span>
          </div>
          <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">{body}</p>
          <div className="mt-1.5 flex items-center text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">
            <span>Tap to open</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification banner"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
