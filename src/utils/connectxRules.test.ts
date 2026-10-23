import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidDocumentId,
  isValidUsername,
  normalizeUsername,
  getDeterministicPairId,
  getDirectedRequestId,
  validateProfileInput,
  validateMessagePayload,
  validateStoryPayload,
  filterActiveStories,
  canTransitionFriendRequest,
  formatNotificationPreview,
  evaluateSecurityRulePayload,
} from './connectxRules';

test('username normalization and validation enforces 3-30 lowercase alphanumeric/underscore rules', () => {
  assert.equal(normalizeUsername('  @Alex_Rivera99 '), 'alex_rivera99');
  assert.equal(isValidUsername('alex_rivera99'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('Invalid-Dash'), false);
  assert.equal(isValidUsername('a'.repeat(31)), false);
});

test('deterministic pair IDs sort UIDs lexicographically and reject self-pairs', () => {
  assert.equal(getDeterministicPairId('user_zeta', 'user_alpha'), 'user_alpha_user_zeta');
  assert.equal(getDeterministicPairId('user_alpha', 'user_zeta'), 'user_alpha_user_zeta');
  assert.throws(() => getDeterministicPairId('user_alpha', 'user_alpha'), /identical UIDs/);
  assert.equal(getDirectedRequestId('user_alpha', 'user_zeta'), 'user_alpha_user_zeta');
});

test('profile validation enforces display name and bio boundaries', () => {
  assert.equal(
    validateProfileInput({ username: 'elena_r', displayName: 'Elena Rostova', bio: 'Architect' }).valid,
    true
  );
  assert.equal(
    validateProfileInput({ username: 'elena_r', displayName: '', bio: 'Architect' }).valid,
    false
  );
  assert.equal(
    validateProfileInput({ username: 'elena_r', displayName: 'Elena', bio: 'x'.repeat(251) }).valid,
    false
  );
});

test('message validation rejects empty text without media and oversized payloads', () => {
  assert.equal(validateMessagePayload('Hello there!', '', 'none').valid, true);
  assert.equal(validateMessagePayload('   ', '', 'none').valid, false);
  assert.equal(validateMessagePayload('a'.repeat(2001), '', 'none').valid, false);
  assert.equal(validateMessagePayload('', 'data:image/svg+xml;utf8,<svg></svg>', 'image').valid, true);
});

test('story expiration and audience filter hides expired, blocked, and non-friend private stories', () => {
  const now = new Date('2026-10-23T12:00:00Z').getTime();
  const stories = [
    {
      id: 'active_public',
      authorUid: 'stranger_1',
      audience: 'public' as const,
      expiresAt: '2026-10-23T18:00:00Z',
    },
    {
      id: 'expired_public',
      authorUid: 'stranger_1',
      audience: 'public' as const,
      expiresAt: '2026-10-23T10:00:00Z',
    },
    {
      id: 'friends_only_stranger',
      authorUid: 'stranger_2',
      audience: 'friends' as const,
      expiresAt: '2026-10-23T18:00:00Z',
    },
    {
      id: 'friends_only_friend',
      authorUid: 'friend_1',
      audience: 'friends' as const,
      expiresAt: '2026-10-23T18:00:00Z',
    },
    {
      id: 'blocked_user_story',
      authorUid: 'blocked_1',
      audience: 'public' as const,
      expiresAt: '2026-10-23T18:00:00Z',
    },
  ];

  const visible = filterActiveStories(
    stories,
    now,
    'me_uid',
    new Set(['friend_1']),
    new Set(['blocked_1'])
  );

  assert.deepEqual(
    visible.map((s) => s.id),
    ['active_public', 'friends_only_friend']
  );
});

test('friend request state machine enforces recipient-only accept/reject and sender-only cancel', () => {
  const req = { fromUid: 'user_a', toUid: 'user_b', status: 'pending' };
  assert.equal(canTransitionFriendRequest(req, 'user_a', 'accepted').allowed, false);
  assert.equal(canTransitionFriendRequest(req, 'user_b', 'accepted').allowed, true);
  assert.equal(canTransitionFriendRequest(req, 'user_a', 'cancelled').allowed, true);
  assert.equal(canTransitionFriendRequest(req, 'user_b', 'cancelled').allowed, false);

  const resolvedReq = { fromUid: 'user_a', toUid: 'user_b', status: 'rejected' };
  assert.equal(canTransitionFriendRequest(resolvedReq, 'user_b', 'accepted').allowed, false);
});

test('notification privacy masks message contents when previewEnabled is false', () => {
  const notif = {
    type: 'new_message',
    actorName: 'Elena Rostova',
    previewText: 'Elena: Here is the private access code 9481',
  };
  assert.equal(
    formatNotificationPreview(notif, false),
    'New private message received (preview hidden by privacy settings)'
  );
  assert.equal(
    formatNotificationPreview(notif, true),
    'Elena: Here is the private access code 9481'
  );
});

test('Dirty Dozen adversarial security payloads all return PERMISSION_DENIED', () => {
  const nowIso = '2026-10-23T13:00:00.000Z';
  const verifiedCtx = { uid: 'user_1', emailVerified: true, nowIso };
  const unverifiedCtx = { uid: 'user_1', emailVerified: false, nowIso };

  // 1. Shadow Privilege Escalation
  const p1 = evaluateSecurityRulePayload(
    'shadow_privilege_escalation',
    { uid: 'user_1', username: 'alex', isAdmin: true },
    verifiedCtx
  );
  assert.equal(p1.allowed, false);

  // 2. Cross-User Profile Hijack
  const p2 = evaluateSecurityRulePayload(
    'cross_user_profile_hijack',
    { targetUserId: 'user_2', uid: 'user_2' },
    verifiedCtx
  );
  assert.equal(p2.allowed, false);

  // 3. Unverified Email Write
  const p3 = evaluateSecurityRulePayload(
    'unverified_email_write',
    { storyId: 'story_1' },
    unverifiedCtx
  );
  assert.equal(p3.allowed, false);

  // 4. PII Leak via /users_private/user_2
  const p4 = evaluateSecurityRulePayload(
    'read_private_pii',
    { requestedUserId: 'user_2' },
    verifiedCtx
  );
  assert.equal(p4.allowed, false);

  // 5. Forged Friend Request Acceptance by Sender
  const p5 = evaluateSecurityRulePayload(
    'forged_request_accept_by_sender',
    { fromUid: 'user_1', toUid: 'user_2', currentStatus: 'pending' },
    verifiedCtx
  );
  assert.equal(p5.allowed, false);

  // 6. Terminal State Re-opening
  const p6 = evaluateSecurityRulePayload(
    'terminal_state_reopen',
    { fromUid: 'user_2', toUid: 'user_1', currentStatus: 'rejected' },
    verifiedCtx
  );
  assert.equal(p6.allowed, false);

  // 7. Spoofed Message Sender
  const p7 = evaluateSecurityRulePayload(
    'spoofed_message_sender',
    { senderId: 'user_2', recipientId: 'user_1' },
    verifiedCtx
  );
  assert.equal(p7.allowed, false);

  // 8. Outsider Reading Private Chat
  const p8 = evaluateSecurityRulePayload(
    'outsider_chat_read',
    { participant1Uid: 'user_2', participant2Uid: 'user_3' },
    verifiedCtx
  );
  assert.equal(p8.allowed, false);

  // 9. Reading Expired Story
  const p9 = evaluateSecurityRulePayload(
    'expired_story_read',
    { expiresAt: '2026-10-22T00:00:00.000Z' },
    verifiedCtx
  );
  assert.equal(p9.allowed, false);

  // 10. Oversized Payload / ID Poisoning
  const p10 = evaluateSecurityRulePayload(
    'oversized_payload_injection',
    { docId: 'bad id with spaces!', displayName: 'x'.repeat(200) },
    verifiedCtx
  );
  assert.equal(p10.allowed, false);

  // 11. Timestamp Forgery
  const p11 = evaluateSecurityRulePayload(
    'timestamp_forgery',
    { createdAt: '2020-01-01T00:00:00.000Z' },
    verifiedCtx
  );
  assert.equal(p11.allowed, false);

  // 12. Immutable Field Mutation
  const p12 = evaluateSecurityRulePayload(
    'immutable_field_mutation',
    {
      existingParticipant1Uid: 'user_1',
      newParticipant1Uid: 'user_99',
      existingCreatedAt: nowIso,
      newCreatedAt: nowIso,
    },
    verifiedCtx
  );
  assert.equal(p12.allowed, false);

  assert.equal(isValidDocumentId('valid_doc-id_123'), true);
});
