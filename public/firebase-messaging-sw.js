importScripts('https://www.gstatic.com/firebasejs/9.20.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.20.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD6UHZSAZjr-vgM3rGvKsJS3W_TDH6fG4s",
  authDomain: "anbanktoken-e378c.firebaseapp.com",
  projectId: "anbanktoken-e378c",
  storageBucket: "anbanktoken-e378c.firebasestorage.app",
  messagingSenderId: "299210750747",
  appId: "1:299210750747:web:4ba5ab63ea75507fdcb1be",
  measurementId: "G-WDKZB9BCNW"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

const seenNotifications = new Set();

// Обработка фоновых сообщений
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Уникальный идентификатор уведомления — messageId или tag
  const notifId = payload.messageId || (payload.notification && payload.notification.tag);

  if (notifId && seenNotifications.has(notifId)) {
    console.log('[firebase-messaging-sw.js] Duplicate notification ignored:', notifId);
    return;
  }
  if (notifId) {
    seenNotifications.add(notifId);
  }

  const notificationTitle = payload.notification?.title || 'Уведомление';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/firebase-logo.png',
    badge: payload.notification?.badge,
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
