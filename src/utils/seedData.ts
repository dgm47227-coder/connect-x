import {
  UserPublicProfile,
  UserPrivateSettings,
  FriendRequest,
  Friendship,
  ChatConversation,
  ChatMessage,
  StoryItem,
  UserBlock,
  AbuseReport,
  UserNotification,
  CallLogEntry,
} from '../types/connectx';

export function createAvatarSvg(initials: string, bgHex: string, accentHex: string): string {
  const safeInitials = (initials || 'CX').slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgHex}" />
        <stop offset="100%" stop-color="${accentHex}" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="60" fill="url(#g)" />
    <circle cx="96" cy="24" r="32" fill="rgba(255,255,255,0.1)" />
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-weight="700" font-size="42" letter-spacing="-1">${safeInitials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createStoryVisualSvg(
  variant: 'aurora' | 'studio' | 'geometry' | 'sunset',
  _title?: string
): string {
  const palettes = {
    aurora: { c1: '#0b141a', c2: '#005c4b', c3: '#00a884', accent: '#34d399' },
    studio: { c1: '#111b21', c2: '#202c33', c3: '#2a3942', accent: '#00a884' },
    geometry: { c1: '#064e3b', c2: '#047857', c3: '#10b981', accent: '#6ee7b7' },
    sunset: { c1: '#1e1b4b', c2: '#312e81', c3: '#4f46e5', accent: '#818cf8' },
  };
  const p = palettes[variant];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 960" width="540" height="960">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.c1}" />
        <stop offset="55%" stop-color="${p.c2}" />
        <stop offset="100%" stop-color="${p.c3}" />
      </linearGradient>
    </defs>
    <rect width="540" height="960" fill="url(#bg)" />
    <circle cx="420" cy="240" r="190" fill="${p.accent}" fill-opacity="0.18" />
    <circle cx="120" cy="680" r="240" fill="${p.accent}" fill-opacity="0.12" />
    <path d="M0 580 Q270 460 540 600 L540 960 L0 960 Z" fill="rgba(11,20,26,0.55)" />
    <rect x="70" y="260" width="400" height="360" rx="32" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" />
    <circle cx="270" cy="440" r="88" fill="${p.accent}" fill-opacity="0.22" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const nowIso = new Date().toISOString();

// Default session template before Firebase Auth / custom user onboarding completes.
// All bot/AI personas and pre-populated fake chats have been removed so only real users appear.
export const INITIAL_CURRENT_USER: UserPublicProfile = {
  uid: 'connectx_member',
  username: 'connectx_user',
  displayName: 'ConnectX Member',
  bio: 'Connected on ConnectX real-time messaging.',
  avatarUrl: createAvatarSvg('CX', '#005c4b', '#00a884'),
  friendsCount: 0,
  privacyWhoCanRequest: 'everyone',
  privacyStoryAudience: 'friends',
  privacyShowReadReceipts: true,
  privacyShowOnlineStatus: true,
  isPublicProfile: true,
  isOnline: true,
  createdAt: nowIso,
  updatedAt: nowIso,
};

export const INITIAL_PRIVATE_SETTINGS: UserPrivateSettings = {
  uid: 'connectx_member',
  email: 'member@connectx.app',
  notificationPreviewEnabled: true,
  notifyFriendRequests: true,
  notifyMessages: true,
  notifyStories: true,
  createdAt: nowIso,
  updatedAt: nowIso,
};

export const INITIAL_DIRECTORY_USERS: UserPublicProfile[] = [];

export const INITIAL_FRIENDSHIPS: Friendship[] = [];

export const INITIAL_FRIEND_REQUESTS: FriendRequest[] = [];

export const INITIAL_CHATS: ChatConversation[] = [];

export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {};

export const INITIAL_STORIES: StoryItem[] = [];

export const INITIAL_BLOCKS: UserBlock[] = [];

export const INITIAL_REPORTS: AbuseReport[] = [];

export const INITIAL_NOTIFICATIONS: UserNotification[] = [];

export const INITIAL_CALL_LOGS: CallLogEntry[] = [];
