importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD6UHZSAZjr-vgM3rGvKsJS3W_TDH6fG4s",
  authDomain: "anbanktoken-e378c.firebaseapp.com",
  projectId: "anbanktoken-e378c",
  storageBucket: "anbanktoken-e378c.firebasestorage.app",
  messagingSenderId: "299210750747",
  appId: "1:299210750747:web:4ba5ab63ea75507fdcb1be",
  measurementId: "G-WDKZB9BCNW"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title || 'Push Notification';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico' // при желании можно добавить иконку уведомления
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
