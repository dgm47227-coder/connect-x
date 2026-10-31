// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the config
firebase.initializeApp({
  projectId: 'gen-lang-client-0669346428',
  appId: '1:155316765682:web:92b78e1828511c6825e16b',
  apiKey: 'AIzaSyBUwpzEpnvAJX17EESl9r1T6Smb7_qZSbg',
  messagingSenderId: '155316765682',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'ConnectX';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message.',
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    vibrate: [150, 80, 150],
    data: payload.data || {},
    tag: payload.data?.tag || 'connectx-fcm',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetId = event.notification.data?.targetId;
  const targetUrl = targetId ? `/?chatId=${targetId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'CONNECTX_NOTIFICATION_CLICK',
            data: event.notification.data,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
