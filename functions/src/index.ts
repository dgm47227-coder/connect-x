import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

interface UserPrivateSettingsDoc {
  notificationsEnabled?: boolean;
  notifyMessages?: boolean;
  notifyCalls?: boolean;
  notifyFriendRequests?: boolean;
  notifyStories?: boolean;
  notificationPreviewEnabled?: boolean;
  mutedChatIds?: string[];
}

/**
 * Prune invalid or unregistered FCM tokens from Firestore
 */
async function cleanupInvalidTokens(tokens: string[], responses: admin.messaging.SendResponse[]): Promise<void> {
  const badTokens: string[] = [];
  responses.forEach((resp, idx) => {
    if (!resp.success && resp.error) {
      const code = resp.error.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        badTokens.push(tokens[idx]);
      }
    }
  });

  if (badTokens.length > 0) {
    const batch = db.batch();
    for (const token of badTokens) {
      const snap = await db.collection('device_tokens').where('token', '==', token).get();
      snap.forEach((doc) => batch.delete(doc.ref));
    }
    await batch.commit().catch((err) => console.error('Token cleanup error:', err));
  }
}

/**
 * 1. Cloud Function Trigger: onMessageCreated
 * Triggers securely when a new message is saved to Firestore: chats/{chatId}/messages/{messageId}
 */
export const onMessageCreated = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    if (!messageData) return;

    const { chatId, messageId } = context.params;
    const recipientId = messageData.recipientId;
    const senderId = messageData.senderId;
    const rawText = messageData.text || '';

    if (!recipientId || !senderId || recipientId === senderId) {
      return; // Do not notify sender or invalid recipients
    }

    // 1. Fetch Recipient Private Settings
    const privDoc = await db.collection('users_private').doc(recipientId).get();
    const settings: UserPrivateSettingsDoc = privDoc.exists ? (privDoc.data() as UserPrivateSettingsDoc) : {};

    // Check master toggle and message notification toggle
    if (settings.notificationsEnabled === false || settings.notifyMessages === false) {
      return;
    }

    // Check per-chat mute settings
    if (settings.mutedChatIds && settings.mutedChatIds.includes(chatId)) {
      return;
    }

    // 2. Fetch Sender Profile for display name
    const senderDoc = await db.collection('users').doc(senderId).get();
    const senderName = senderDoc.exists ? senderDoc.data()?.displayName || 'A user' : 'A user';

    // 3. Privacy-conscious notification appearance
    const isPreviewEnabled = settings.notificationPreviewEnabled !== false;
    const title = isPreviewEnabled ? `New message from ${senderName}` : 'New message';
    const body = isPreviewEnabled
      ? rawText.slice(0, 120) || 'Sent an attachment'
      : 'You have a new message.';

    // 4. Retrieve Active Device Tokens for Recipient
    const tokensSnap = await db.collection('device_tokens').where('uid', '==', recipientId).get();
    if (tokensSnap.empty) return;

    const tokens: string[] = [];
    tokensSnap.forEach((doc) => {
      const data = doc.data();
      if (data.token && typeof data.token === 'string') {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) return;

    // 5. Send FCM Multicast
    const payload: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        type: 'new_message',
        chatId,
        messageId,
        senderId,
        tag: `chat_${chatId}`,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'connectx_messages',
          icon: 'ic_launcher',
          color: '#25d366',
          tag: `chat_${chatId}`,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            badge: 1,
            sound: 'default',
          },
        },
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          tag: `chat_${chatId}`,
        },
        data: {
          targetId: chatId,
          type: 'new_message',
        },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(payload);
      if (response.failureCount > 0) {
        await cleanupInvalidTokens(tokens, response.responses);
      }
    } catch (error) {
      console.error('Error delivering message push notification:', error);
    }
  });

/**
 * 2. Cloud Function Trigger: onNotificationCreated
 * Triggers when meaningful system, call, or friend events are logged in /notifications/{notificationId}
 */
export const onNotificationCreated = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notif = snap.data();
    if (!notif) return;

    const { notificationId } = context.params;
    const { recipientUid, actorUid, actorName, type, previewText, targetId, callType } = notif;

    if (!recipientUid || recipientUid === actorUid) return;

    // Fetch Recipient Settings
    const privDoc = await db.collection('users_private').doc(recipientUid).get();
    const settings: UserPrivateSettingsDoc = privDoc.exists ? (privDoc.data() as UserPrivateSettingsDoc) : {};

    if (settings.notificationsEnabled === false) return;

    // Filter by event type preferences
    if (
      (type === 'incoming_call' || type === 'incoming_video_call' || type === 'missed_call') &&
      settings.notifyCalls === false
    ) {
      return;
    }
    if (
      (type === 'friend_request' || type === 'friend_accepted') &&
      settings.notifyFriendRequests === false
    ) {
      return;
    }
    if (type === 'story_view' && settings.notifyStories === false) {
      return;
    }

    const isPreviewEnabled = settings.notificationPreviewEnabled !== false;

    // Configure notification title and body based on event
    let title = 'ConnectX Alert';
    let body = previewText || 'You have an update.';

    if (type === 'incoming_call') {
      title = 'Incoming voice call';
      body = isPreviewEnabled ? `${actorName} is calling you.` : 'Someone is calling you.';
    } else if (type === 'incoming_video_call') {
      title = 'Incoming video call';
      body = isPreviewEnabled ? `${actorName} is video calling you.` : 'You have an incoming video call.';
    } else if (type === 'missed_call') {
      title = 'Missed call';
      body = isPreviewEnabled ? `You missed a call from ${actorName}.` : 'You missed a call.';
    } else if (type === 'friend_request') {
      title = 'New friend request';
      body = isPreviewEnabled ? `${actorName} sent you a friend request.` : 'You received a friend request.';
    } else if (type === 'friend_accepted') {
      title = 'Friend request accepted';
      body = isPreviewEnabled ? `${actorName} accepted your friend request.` : 'Your friend request was accepted.';
    } else if (type === 'security_alert') {
      title = 'ConnectX Security Alert';
      body = previewText || 'Security notice for your ConnectX account.';
    }

    // Retrieve Active Device Tokens
    const tokensSnap = await db.collection('device_tokens').where('uid', '==', recipientUid).get();
    if (tokensSnap.empty) return;

    const tokens: string[] = [];
    tokensSnap.forEach((doc) => {
      const data = doc.data();
      if (data.token) tokens.push(data.token);
    });

    if (tokens.length === 0) return;

    const isCall = type === 'incoming_call' || type === 'incoming_video_call';

    const payload: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data: {
        type,
        notificationId,
        actorUid: String(actorUid || ''),
        targetId: String(targetId || ''),
        callType: String(callType || ''),
      },
      android: {
        priority: isCall ? 'high' : 'normal',
        notification: {
          channelId: isCall ? 'connectx_calls' : 'connectx_alerts',
          icon: 'ic_launcher',
          color: '#25d366',
          sound: isCall ? 'ringtone' : 'default',
        },
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          tag: `notif_${type}_${notificationId}`,
        },
        data: {
          targetId: targetId || '',
          type,
        },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(payload);
      if (response.failureCount > 0) {
        await cleanupInvalidTokens(tokens, response.responses);
      }
    } catch (err) {
      console.error('Error delivering notification event push:', err);
    }
  });
