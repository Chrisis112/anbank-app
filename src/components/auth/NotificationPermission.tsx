'use client';

import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { initializeApp, FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyD6UHZSAZjr-vgM3rGvKsJS3W_TDH6fG4s",
  authDomain: "anbanktoken-e378c.firebaseapp.com",
  projectId: "anbanktoken-e378c",
  storageBucket: "anbanktoken-e378c.firebasestorage.app",
  messagingSenderId: "299210750747",
  appId: "1:299210750747:web:4ba5ab63ea75507fdcb1be",
  measurementId: "G-WDKZB9BCNW"
};

let app: FirebaseApp | undefined;
let messaging: Messaging | undefined;

export default function NotificationPermission({ onToken }: { onToken?: (token: string) => void }) {
  const [permission, setPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Notifications or Service Worker not supported.');
      return;
    }

    async function initializePush() {
      try {
        if (!app) {
          app = initializeApp(firebaseConfig);
          messaging = getMessaging(app);
        }
        // Регистрация service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered:', registration);

        // Запрос разрешения
        let currentPermission = Notification.permission;
        if (currentPermission === 'default') {
          currentPermission = await Notification.requestPermission();
          setPermission(currentPermission);
        }

        if (currentPermission !== 'granted') {
          throw new Error('Notification permission not granted');
        }

        // Проверка VAPID ключа из env
        const vapidKey = process.env.NEXT_PUBLIC_VAPID;
        if (!vapidKey) {
          throw new Error('VAPID key is not set');
        }

        if (!messaging) {
          throw new Error('Firebase messaging not initialized');
        }

        // Получение push токена с передачей serviceWorkerRegistration
        const currentToken = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (currentToken) {
          console.log('Push token:', currentToken);
          if (onToken) onToken(currentToken);
        } else {
          console.warn('No registration token available. Request permission to generate one.');
        }
      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    }

    initializePush();

    // Обработка foreground push уведомлений
    const unsubscribeOnMessage = messaging
      ? onMessage(messaging, (payload) => {
          console.log('Foreground push message:', payload);
          // Можно показать кастомные уведомления UI
        })
      : () => {};

    return () => {
      unsubscribeOnMessage();
    };
  }, [onToken]);

  return null;
}
