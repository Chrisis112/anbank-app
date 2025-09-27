'use client';

import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import axios from 'axios';
import { initializeApp } from 'firebase/app';

// Вставьте сюда ваши ключи Firebase из firebaseConfig
const firebaseConfig = {
  apiKey: "AIzaSyD6UHZSAZjr-vgM3rGvKsJS3W_TDH6fG4s",
  authDomain: "anbanktoken-e378c.firebaseapp.com",
  projectId: "anbanktoken-e378c",
  storageBucket: "anbanktoken-e378c.firebasestorage.app",
  messagingSenderId: "299210750747",
  appId: "1:299210750747:web:4ba5ab63ea75507fdcb1be",
  measurementId: "G-WDKZB9BCNW"
};
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID || '';

const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

export default function PushNotificationsManager() {

useEffect(() => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker не поддерживается');
    return;
  }

  let registration: ServiceWorkerRegistration;

  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(reg => {
      registration = reg;
      console.log('Service Worker зарегистрирован:', registration);

      return Notification.requestPermission();
    })
    .then(permission => {
      if (permission !== 'granted') {
        throw new Error('Разрешение на уведомления не предоставлено');
      }

      return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    })
    .then(token => {
      if (token) {
        console.log('Получен push токен:', token);
        // отправьте токен на сервер...
      }
    })
    .catch(console.error);

  const unsubscribeOnMessage = onMessage(messaging, payload => {
    console.log('Foreground message:', payload);
  });

  return () => unsubscribeOnMessage();
}, []);
  return null; // компонент не рендерит UI
}
