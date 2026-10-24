export type NavTab = 'chats' | 'friends' | 'discover' | 'stories' | 'profile';

export type FriendRequestPolicy = 'everyone' | 'none';
export type StoryAudience = 'friends' | 'public';
export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface UserPublicProfile {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  friendsCount: number;
  privacyWhoCanRequest: FriendRequestPolicy;
  privacyStoryAudience: StoryAudience;
  privacyShowReadReceipts: boolean;
  privacyShowOnlineStatus: boolean;
  isPublicProfile: boolean;
  isOnline?: boolean;
  mutualFriendsCount?: number;
  suggestionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPrivateSettings {
  uid: string;
  email: string;
  notificationPreviewEnabled: boolean;
  notifyFriendRequests: boolean;
  notifyMessages: boolean;
  notifyStories: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FriendRequest {
  requestId: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromAvatarUrl: string;
  toUid: string;
  toUsername: string;
  toDisplayName: string;
  toAvatarUrl: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Friendship {
  friendshipId: string;
  user1Uid: string;
  user2Uid: string;
  user1Username: string;
  user2Username: string;
  user1DisplayName: string;
  user2DisplayName: string;
  user1AvatarUrl: string;
  user2AvatarUrl: string;
  status: 'active';
  createdAt: string;
}

export interface ChatConversation {
  chatId: string;
  participant1Uid: string;
  participant2Uid: string;
  participant1Name: string;
  participant2Name: string;
  participant1Username: string;
  participant2Username: string;
  participant1Avatar: string;
  participant2Avatar: string;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageStatus: MessageDeliveryStatus;
  unreadCount1: number;
  unreadCount2: number;
  typingUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  recipientId: string;
  text: string;
  mediaUrl: string;
  mediaType: 'none' | 'image';
  replyToMessageId: string;
  replyToText: string;
  status: MessageDeliveryStatus;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoryViewRecord {
  viewerUid: string;
  storyAuthorUid: string;
  viewerUsername: string;
  viewerDisplayName: string;
  viewedAt: string;
}

export interface StoryItem {
  storyId: string;
  authorUid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  mediaType: 'text' | 'image';
  caption: string;
  mediaUrl: string;
  backgroundStyle: string;
  audience: StoryAudience;
  viewersCount: number;
  viewers?: StoryViewRecord[];
  createdAt: string;
  expiresAt: string;
}

export interface UserBlock {
  blockId: string;
  blockerUid: string;
  blockedUid: string;
  blockedUsername: string;
  blockedDisplayName: string;
  reason: string;
  createdAt: string;
}

export interface AbuseReport {
  reportId: string;
  reporterUid: string;
  targetUid: string;
  targetLabel?: string;
  targetType: 'user' | 'message' | 'story';
  reasonCategory: 'spam' | 'harassment' | 'inappropriate' | 'impersonation' | 'other';
  details: string;
  status: 'open' | 'reviewed' | 'resolved';
  createdAt: string;
}

export interface UserNotification {
  notificationId: string;
  recipientUid: string;
  actorUid: string;
  actorName: string;
  actorUsername: string;
  type: 'friend_request' | 'friend_accepted' | 'new_message' | 'story_view';
  previewText: string;
  isRead: boolean;
  createdAt: string;
}

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'connected' | 'ended' | 'missed';

export interface CallLogEntry {
  callId: string;
  chatId: string;
  callerUid: string;
  peerUid: string;
  peerName: string;
  peerUsername: string;
  peerAvatar: string;
  callType: CallType;
  direction: 'outgoing' | 'incoming';
  status: CallStatus;
  durationSeconds: number;
  createdAt: string;
}

