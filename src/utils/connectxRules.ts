export const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export function isValidDocumentId(id: string): boolean {
  if (typeof id !== 'string') return false;
  return id.length >= 1 && id.length <= 128 && ID_PATTERN.test(id);
}

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

export function isValidUsername(username: string): boolean {
  if (typeof username !== 'string') return false;
  return username.length >= 3 && username.length <= 30 && USERNAME_PATTERN.test(username);
}

export function getDeterministicPairId(uidA: string, uidB: string): string {
  if (!isValidDocumentId(uidA) || !isValidDocumentId(uidB)) {
    throw new Error('Invalid participant UID format');
  }
  if (uidA === uidB) {
    throw new Error('Cannot create pair ID for identical UIDs');
  }
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export function getDirectedRequestId(fromUid: string, toUid: string): string {
  if (!isValidDocumentId(fromUid) || !isValidDocumentId(toUid)) {
    throw new Error('Invalid UID format');
  }
  if (fromUid === toUid) {
    throw new Error('Cannot send friend request to yourself');
  }
  return `${fromUid}_${toUid}`;
}

export function validateProfileInput(input: {
  username: string;
  displayName: string;
  bio: string;
}): { valid: boolean; error?: string } {
  const normalized = normalizeUsername(input.username);
  if (!isValidUsername(normalized)) {
    return {
      valid: false,
      error: 'Username must be 3–30 characters using lowercase letters, numbers, or underscores.',
    };
  }
  const trimmedName = input.displayName.trim();
  if (trimmedName.length < 1 || trimmedName.length > 60) {
    return {
      valid: false,
      error: 'Display name must be between 1 and 60 characters.',
    };
  }
  if (input.bio.length > 250) {
    return {
      valid: false,
      error: 'Bio cannot exceed 250 characters.',
    };
  }
  return { valid: true };
}

export function validateMessagePayload(
  text: string,
  mediaUrl: string,
  mediaType: 'none' | 'image'
): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  if (mediaType === 'none' && trimmed.length === 0) {
    return { valid: false, error: 'Message text cannot be empty.' };
  }
  if (trimmed.length > 2000) {
    return { valid: false, error: 'Message text cannot exceed 2,000 characters.' };
  }
  if (mediaType === 'image') {
    if (!mediaUrl || mediaUrl.length === 0) {
      return { valid: false, error: 'Image attachment requires a valid media URL.' };
    }
    if (mediaUrl.length > 50000) {
      return { valid: false, error: 'Image payload exceeds the 50KB Firestore document safety limit.' };
    }
  }
  return { valid: true };
}

export function validateStoryPayload(
  caption: string,
  mediaType: 'text' | 'image',
  mediaUrl: string
): { valid: boolean; error?: string } {
  const trimmed = caption.trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    return { valid: false, error: 'Story caption must be between 1 and 500 characters.' };
  }
  if (mediaType === 'image') {
    if (!mediaUrl || mediaUrl.length === 0) {
      return { valid: false, error: 'Photo story requires an image.' };
    }
    if (mediaUrl.length > 50000) {
      return { valid: false, error: 'Story image exceeds the 50KB size limit.' };
    }
  }
  return { valid: true };
}

export function filterActiveStories<
  T extends {
    expiresAt: string;
    authorUid: string;
    audience: 'public' | 'friends';
  }
>(
  stories: T[],
  nowMs: number,
  viewerUid: string,
  friendUids: Set<string>,
  blockedUids: Set<string>
): T[] {
  return stories.filter((story) => {
    const expiresMs = new Date(story.expiresAt).getTime();
    if (Number.isNaN(expiresMs) || expiresMs <= nowMs) {
      return false;
    }
    if (blockedUids.has(story.authorUid)) {
      return false;
    }
    if (story.authorUid === viewerUid) {
      return true;
    }
    if (story.audience === 'public') {
      return true;
    }
    return friendUids.has(story.authorUid);
  });
}

export function canTransitionFriendRequest(
  request: { fromUid: string; toUid: string; status: string },
  actorUid: string,
  nextStatus: 'accepted' | 'rejected' | 'cancelled'
): { allowed: boolean; reason?: string } {
  if (request.status !== 'pending') {
    return { allowed: false, reason: 'Terminal state lock: only pending requests can be updated.' };
  }
  if (nextStatus === 'accepted' || nextStatus === 'rejected') {
    if (actorUid !== request.toUid) {
      return { allowed: false, reason: 'Only the recipient can accept or reject a friend request.' };
    }
    return { allowed: true };
  }
  if (nextStatus === 'cancelled') {
    if (actorUid !== request.fromUid) {
      return { allowed: false, reason: 'Only the sender can cancel an outgoing friend request.' };
    }
    return { allowed: true };
  }
  return { allowed: false, reason: 'Unsupported status transition.' };
}

export function formatNotificationPreview(
  notification: { type: string; actorName: string; previewText: string },
  previewEnabled: boolean
): string {
  if (previewEnabled) {
    return notification.previewText;
  }
  if (notification.type === 'new_message') {
    return 'New private message received (preview hidden by privacy settings)';
  }
  if (notification.type === 'incoming_call') {
    return 'Incoming voice call (preview hidden by privacy settings)';
  }
  if (notification.type === 'incoming_video_call') {
    return 'Incoming video call (preview hidden by privacy settings)';
  }
  if (notification.type === 'missed_call') {
    return 'Missed call (preview hidden by privacy settings)';
  }
  return notification.previewText;
}

export function isChatMuted(
  settings?: { mutedChatIds?: string[] } | null,
  chatId?: string | null
): boolean {
  if (!settings || !settings.mutedChatIds || !chatId) return false;
  return settings.mutedChatIds.includes(chatId);
}

export function shouldDeliverNotification(
  type: string,
  settings?: {
    notificationsEnabled?: boolean;
    notifyMessages?: boolean;
    notifyCalls?: boolean;
    notifyFriendRequests?: boolean;
    notifyStories?: boolean;
    mutedChatIds?: string[];
  } | null,
  chatId?: string | null
): boolean {
  if (!settings) return true;
  if (settings.notificationsEnabled === false) return false;

  if (chatId && isChatMuted(settings, chatId)) {
    return false;
  }

  if (type === 'new_message' && settings.notifyMessages === false) {
    return false;
  }

  if (
    (type === 'incoming_call' || type === 'incoming_video_call' || type === 'missed_call') &&
    settings.notifyCalls === false
  ) {
    return false;
  }

  if (
    (type === 'friend_request' || type === 'friend_accepted') &&
    settings.notifyFriendRequests === false
  ) {
    return false;
  }

  if (type === 'story_view' && settings.notifyStories === false) {
    return false;
  }

  return true;
}

export function formatNotificationTitle(
  type: string,
  actorName: string,
  previewEnabled: boolean
): string {
  switch (type) {
    case 'new_message':
      return previewEnabled ? `New message from ${actorName}` : 'New message';
    case 'incoming_call':
      return 'Incoming voice call';
    case 'incoming_video_call':
      return 'Incoming video call';
    case 'missed_call':
      return 'Missed call';
    case 'friend_request':
      return previewEnabled ? `Friend request from ${actorName}` : 'New friend request';
    case 'friend_accepted':
      return previewEnabled ? `${actorName} accepted your request` : 'Friend request accepted';
    case 'security_alert':
      return 'ConnectX Security Alert';
    default:
      return 'ConnectX Notification';
  }
}

export function formatNotificationBody(
  type: string,
  actorName: string,
  contentSnippet: string,
  previewEnabled: boolean
): string {
  switch (type) {
    case 'new_message':
      return previewEnabled && contentSnippet
        ? contentSnippet
        : 'You have a new message.';
    case 'incoming_call':
      return previewEnabled ? `${actorName} is calling you.` : 'Someone is calling you.';
    case 'incoming_video_call':
      return previewEnabled
        ? `${actorName} is requesting a video call.`
        : 'You have an incoming video call.';
    case 'missed_call':
      return previewEnabled ? `You missed a call from ${actorName}.` : 'You missed a call.';
    case 'friend_request':
      return previewEnabled
        ? `${actorName} sent you a friend request.`
        : 'You received a friend request.';
    case 'friend_accepted':
      return previewEnabled
        ? `${actorName} accepted your friend request.`
        : 'Your friend request was accepted.';
    case 'security_alert':
      return contentSnippet || 'Important security update for your account.';
    default:
      return contentSnippet || 'You have a new notification.';
  }
}

export function formatRemainingStoryTime(expiresAtIso: string, nowMs: number = Date.now()): string {
  const diffMs = new Date(expiresAtIso).getTime() - nowMs;
  if (diffMs <= 0) return 'Expired';
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${Math.max(1, minutes)}m left`;
}

export function formatCallDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function canStartCallWithPeer(
  callerUid: string,
  peerUid: string,
  blockedUids: Set<string>
): { allowed: boolean; reason?: string } {
  if (!isValidDocumentId(callerUid) || !isValidDocumentId(peerUid)) {
    return { allowed: false, reason: 'Invalid caller or recipient UID.' };
  }
  if (callerUid === peerUid) {
    return { allowed: false, reason: 'Cannot initiate a call with yourself.' };
  }
  if (blockedUids.has(peerUid)) {
    return { allowed: false, reason: 'Cannot call a blocked account.' };
  }
  return { allowed: true };
}

export interface SecurityCheckContext {
  uid: string | null;
  emailVerified: boolean;
  nowIso: string;
}

/**
 * Deterministic evaluator mirroring the Firestore Security Rules in firestore.rules
 * Used to verify the Dirty Dozen adversarial payloads in unit tests and the in-app security auditor.
 */
export function evaluateSecurityRulePayload(
  scenarioId: string,
  payload: Record<string, unknown>,
  ctx: SecurityCheckContext
): { allowed: boolean; violation: string } {
  if (!ctx.uid) {
    return { allowed: false, violation: 'PERMISSION_DENIED: Unauthenticated request' };
  }
  if (!ctx.emailVerified && scenarioId !== 'read_private_pii' && scenarioId !== 'outsider_chat_read' && scenarioId !== 'expired_story_read') {
    return { allowed: false, violation: 'PERMISSION_DENIED: Email verification required for writes' };
  }

  switch (scenarioId) {
    case 'shadow_privilege_escalation': {
      const allowedKeys = new Set([
        'uid', 'username', 'displayName', 'bio', 'avatarUrl',
        'friendsCount', 'privacyWhoCanRequest', 'privacyStoryAudience',
        'privacyShowReadReceipts', 'privacyShowOnlineStatus',
        'isPublicProfile', 'createdAt', 'updatedAt',
      ]);
      for (const k of Object.keys(payload)) {
        if (!allowedKeys.has(k)) {
          return { allowed: false, violation: `PERMISSION_DENIED: Shadow field '${k}' rejected by hasOnly() gate` };
        }
      }
      return { allowed: true, violation: '' };
    }
    case 'cross_user_profile_hijack': {
      if (payload.targetUserId !== ctx.uid || payload.uid !== ctx.uid) {
        return { allowed: false, violation: 'PERMISSION_DENIED: Profile UID mismatch against request.auth.uid' };
      }
      return { allowed: true, violation: '' };
    }
    case 'unverified_email_write': {
      if (!ctx.emailVerified) {
        return { allowed: false, violation: 'PERMISSION_DENIED: request.auth.token.email_verified == true required' };
      }
      return { allowed: true, violation: '' };
    }
    case 'read_private_pii': {
      if (payload.requestedUserId !== ctx.uid) {
        return { allowed: false, violation: 'PERMISSION_DENIED: /users_private/{userId} isolated to owner only' };
      }
      return { allowed: true, violation: '' };
    }
    case 'forged_request_accept_by_sender': {
      const check = canTransitionFriendRequest(
        {
          fromUid: String(payload.fromUid),
          toUid: String(payload.toUid),
          status: String(payload.currentStatus || 'pending'),
        },
        ctx.uid,
        'accepted'
      );
      if (!check.allowed) {
        return { allowed: false, violation: `PERMISSION_DENIED: ${check.reason}` };
      }
      return { allowed: true, violation: '' };
    }
    case 'terminal_state_reopen': {
      if (payload.currentStatus !== 'pending') {
        return { allowed: false, violation: 'PERMISSION_DENIED: Terminal state lock prevents modifying resolved request' };
      }
      return { allowed: true, violation: '' };
    }
    case 'spoofed_message_sender': {
      if (payload.senderId !== ctx.uid) {
        return { allowed: false, violation: 'PERMISSION_DENIED: incoming().senderId must equal request.auth.uid' };
      }
      return { allowed: true, violation: '' };
    }
    case 'outsider_chat_read': {
      const p1 = String(payload.participant1Uid);
      const p2 = String(payload.participant2Uid);
      if (ctx.uid !== p1 && ctx.uid !== p2) {
        return { allowed: false, violation: 'PERMISSION_DENIED: Master Gate rejected non-participant read on /chats/{chatId}' };
      }
      return { allowed: true, violation: '' };
    }
    case 'expired_story_read': {
      const expiresMs = new Date(String(payload.expiresAt)).getTime();
      const nowMs = new Date(ctx.nowIso).getTime();
      if (expiresMs <= nowMs) {
        return { allowed: false, violation: 'PERMISSION_DENIED: Story expired (resource.data.expiresAt <= request.time)' };
      }
      return { allowed: true, violation: '' };
    }
    case 'oversized_payload_injection': {
      const name = String(payload.displayName || '');
      const docId = String(payload.docId || 'valid_id');
      if (!isValidDocumentId(docId) || name.length > 60) {
        return { allowed: false, violation: 'PERMISSION_DENIED: Volumetric boundary limit exceeded (.size() <= 60)' };
      }
      return { allowed: true, violation: '' };
    }
    case 'timestamp_forgery': {
      if (payload.createdAt !== ctx.nowIso) {
        return { allowed: false, violation: 'PERMISSION_DENIED: Temporal integrity requires incoming().createdAt == request.time' };
      }
      return { allowed: true, violation: '' };
    }
    case 'immutable_field_mutation': {
      if (payload.newParticipant1Uid !== payload.existingParticipant1Uid || payload.newCreatedAt !== payload.existingCreatedAt) {
        return { allowed: false, violation: 'PERMISSION_DENIED: Immortal field mutation blocked on update' };
      }
      return { allowed: true, violation: '' };
    }
    default:
      return { allowed: false, violation: 'PERMISSION_DENIED: Default deny rule' };
  }
}
