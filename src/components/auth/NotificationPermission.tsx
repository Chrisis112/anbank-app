'use client';

import { useEffect, useState } from 'react';
import { getMessaging, getToken, Messaging } from 'firebase/messaging';
import { initializeApp, FirebaseApp } from 'firebase/app';


// Конфиг Firebase — замените на свой
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
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications.');
      return;
    }

    if (!app) {
      app = initializeApp(firebaseConfig);
      messaging = getMessaging(app);
    }

    setPermission(Notification.permission);

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        setPermission(perm);
        if (perm === 'granted') {
          registerForPush();
        }
      });
    } else if (Notification.permission === 'granted') {
      registerForPush();
    }
  }, []);

  const registerForPush = async () => {
    if (!messaging) {
      console.error('Firebase messaging is not initialized.');
      return;
    }
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID;
      if (!vapidKey) {
        console.error('VAPID key is not set');
        return;
      }
      const currentToken = await getToken(messaging, { vapidKey });
      if (currentToken) {
        console.log('Push token:', currentToken);
        if (onToken) onToken(currentToken);
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } catch (error) {
      console.error('An error occurred while retrieving token.', error);
    }
  };

  return null;
}