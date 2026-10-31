export type NavTab = 'chats' | 'friends' | 'discover' | 'stories' | 'profile';

export type FriendRequestPolicy = 'everyone' | 'none';
export type StoryAudience = 'friends' | 'public';
export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
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
  notificationsEnabled?: boolean;
  notifyCalls?: boolean;
  notifySound?: boolean;
  notifyVibrate?: boolean;
  mutedChatIds?: string[];
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
  isEdited?: boolean;
  isEncrypted?: boolean;
  ciphertext?: string;
  iv?: string;
  keyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupChat {
  groupId: string;
  name: string;
  description: string;
  avatarUrl: string;
  creatorUid: string;
  adminUids: string[];
  memberUids: string[];
  memberNames: Record<string, string>;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageSenderName: string;
  isEncrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMessage {
  messageId: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  mediaUrl: string;
  mediaType: 'none' | 'image';
  isEncrypted?: boolean;
  ciphertext?: string;
  iv?: string;
  status: MessageDeliveryStatus;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserKeyRecord {
  uid: string;
  publicKeyJwk: string;
  safetyNumber: string;
  algorithm: string;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0 (very weak) to 4 (strong)
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  feedback: string[];
}

export interface RegisteredDevice {
  tokenId: string;
  uid: string;
  platform: 'android' | 'ios' | 'web';
  deviceModel: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
  isCurrentDevice?: boolean;
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

export type UserNotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'new_message'
  | 'story_view'
  | 'incoming_call'
  | 'incoming_video_call'
  | 'missed_call'
  | 'security_alert';

export interface UserNotification {
  notificationId: string;
  recipientUid: string;
  actorUid: string;
  actorName: string;
  actorUsername: string;
  type: UserNotificationType;
  previewText: string;
  isRead: boolean;
  createdAt: string;
  targetId?: string;
  callType?: CallType;
}

export interface DeviceTokenRecord {
  tokenId: string;
  uid: string;
  token: string;
  platform: 'android' | 'ios' | 'web';
  deviceModel?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected' | 'busy';

export interface RTCSdpPayload {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface RTCIceCandidatePayload {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface CallSessionDoc {
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
  status: CallStatus;
  offer?: RTCSdpPayload;
  answer?: RTCSdpPayload;
  createdAt: string;
  updatedAt: string;
}

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

