'use client';

import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';

// Конфиг Firebase (замени на свой)
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export default function NotificationPermission({ onToken }: { onToken?: (token: string) => void }) {
  const [permission, setPermission] = useState(Notification.permission);

  useEffect(() => {
    if (permission === 'default') {
      // Запрашиваем разрешение у пользователя на пуш-уведомления
      Notification.requestPermission().then((perm) => {
        setPermission(perm);
        if (perm === 'granted') {
          registerForPush();
        }
      });
    } else if (permission === 'granted') {
      registerForPush();
    }
  }, [permission]);

  const registerForPush = async () => {
    try {
      // Получаем пуш токен Firebase
      const currentToken = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY',
      });
      if (currentToken) {
        console.log('Push token:', currentToken);
        if (onToken) onToken(currentToken);
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } catch (error) {
      console.error('An error occurred while retrieving token. ', error);
    }
  };

  return null;
}
