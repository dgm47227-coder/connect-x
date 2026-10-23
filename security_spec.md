# ConnectX Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Authentication & Verification**: All database access requires an authenticated user (`request.auth != null`). Write operations require verified identity (`request.auth.token.email_verified == true`).
2. **PII Isolation**: User email addresses and private notification preferences live exclusively in `/users_private/{userId}` and are readable/writable only when `request.auth.uid == userId`. `/users/{userId}` contains zero PII.
3. **Profile Ownership**: A user can only create or update `/users/{userId}` where `userId == request.auth.uid` and `incoming().uid == request.auth.uid`. `createdAt` and `uid` are immutable.
4. **Unique Username Integrity**: `/usernames/{username}` can only be created if the username matches `^[a-z0-9_]+$` (length 3..30) and `uid == request.auth.uid`.
5. **Friend Request Authorization & Blocking**:
   - A friend request `/friendRequests/{requestId}` can only be created with `fromUid == request.auth.uid`, `toUid != request.auth.uid`, `status == 'pending'`, and only if neither user has blocked the other (`!exists(/databases/$(database)/documents/blocks/$(fromUid + '_' + toUid))` and `!exists(/databases/$(database)/documents/blocks/$(toUid + '_' + fromUid))`).
   - Only `toUid` may transition a `pending` request to `accepted` or `rejected`.
   - Only `fromUid` may transition a `pending` request to `cancelled`.
   - Terminal statuses (`accepted`, `rejected`, `cancelled`) cannot be updated further.
6. **Conversation & Message Isolation (Master Gate)**:
   - Only `participant1Uid` or `participant2Uid` can read or update `/chats/{chatId}`.
   - Subcollection `/chats/{chatId}/messages/{messageId}` validates via `get(/databases/$(database)/documents/chats/$(chatId))` that `request.auth.uid` is one of the parent chat's participants and is not blocked by the recipient.
   - `senderId` on a new message must strictly equal `request.auth.uid`.
7. **Story Expiration Enforcement**:
   - `/stories/{storyId}` can only be read (`get` or `list`) when `resource.data.expiresAt > request.time`. Expired stories are rejected by Firestore Security Rules at the server level.
8. **Abuse Reports**:
   - `/reports/{reportId}` can only be created with `reporterUid == request.auth.uid` and `status == 'open'`. Reports are immutable after submission for non-admins.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Shadow Privilege Escalation on `/users/{userId}`)**:
   `{ "uid": "user_1", "username": "alex", "displayName": "Alex", "isAdmin": true }` -> Rejected by `hasOnly()` strict key check.
2. **Payload 2 (Cross-User Profile Hijack on `/users/user_2`)**:
   Authenticated as `user_1`, writing `{ "uid": "user_2", "username": "victim" }` -> Rejected by `request.auth.uid == userId`.
3. **Payload 3 (Unauthenticated / Unverified Write)**:
   Authenticated with `email_verified: false` attempting to create `/stories/story_1` -> Rejected by `isVerifiedUser()`.
4. **Payload 4 (PII Leak via `/users_private/user_2`)**:
   Authenticated as `user_1`, attempting `get` on `/users_private/user_2` -> Rejected by `isOwner(userId)`.
5. **Payload 5 (Forged Friend Request Acceptance by Sender)**:
   Authenticated as `fromUid` (`user_1`), updating `/friendRequests/user_1_user_2` to `{ "status": "accepted" }` -> Rejected because only `toUid` (`user_2`) can accept/reject.
6. **Payload 6 (Terminal State Re-opening on `/friendRequests`)**:
   Updating a `rejected` friend request back to `pending` or `accepted` -> Rejected by Terminal State Lock (`existing().status == 'pending'`).
7. **Payload 7 (Spoofed Message Sender in `/chats/{chatId}/messages/{messageId}`)**:
   Participant `user_1` sending a message with `senderId: "user_2"` -> Rejected by `incoming().senderId == request.auth.uid`.
8. **Payload 8 (Outsider Reading Private Chat `/chats/{chatId}/messages`)**:
   Authenticated `user_3` attempting to read or list messages in `user_1_user_2` -> Rejected by Master Gate check on parent `/chats/{chatId}`.
9. **Payload 9 (Reading Expired Story `/stories/{storyId}`)**:
   Attempting to read a story where `expiresAt <= request.time` -> Rejected by `resource.data.expiresAt > request.time`.
10. **Payload 10 (Resource Exhaustion / 1MB String Injection)**:
    Injecting a 10,000-character `displayName` or 200-character document ID -> Rejected by `isValidId()` and `.size() <= 60`.
11. **Payload 11 (Timestamp Forgery)**:
    Creating a message or profile with backdated `createdAt` (`2020-01-01T00:00:00Z`) -> Rejected by `incoming().createdAt == request.time`.
12. **Payload 12 (Mutating Immutable Ownership Fields on Update)**:
    Updating `participant1Uid` or `createdAt` on an existing `/chats/{chatId}` document -> Rejected by `affectedKeys().hasOnly(...)` and immutability gates.
