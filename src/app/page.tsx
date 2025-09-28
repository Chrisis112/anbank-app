'use client';

import { useEffect, useRef } from 'react';
import RegistrationForm from '../components/auth/RegistrationForm';
import NotificationPermission from '@/components/auth/NotificationPermission';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Buffer } from 'buffer';
import { messaging, onMessage, getToken } from '@/utils/firebase-config';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

export default function HomePage() {
  const user = useAuthStore(state => state.user);
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Для отслеживания уже показанных уведомлений и предотвращения дублей
  const seenNotifications = useRef(new Set<string>());

  // Регистрация и обновление push-токена при изменении user или токена авторизации
  useEffect(() => {
    async function registerPushToken() {
      if (!user?.id || !authToken || !messaging) return;

      try {
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_VAPID as string,
        });
        if (token) {
          await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/subscribe`,
            { subscription: token, userId: user.id },
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          console.log('Push token registered/updated');
        } else {
          console.warn('No push token available');
        }
      } catch (error) {
        console.error('Failed to register push token:', error);
      }
    }

    registerPushToken();
  }, [user, authToken]);

  // Обработка foreground сообщений с фильтрацией дубликатов
  useEffect(() => {
    if (typeof window !== 'undefined' && messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
const notifId = payload.messageId || (payload.notification && (payload.notification as any)['tag']);
        if (notifId && seenNotifications.current.has(notifId)) {
          console.log('Duplicate notification ignored', notifId);
          return;
        }
        if (notifId) seenNotifications.current.add(notifId);

        if (Notification.permission === 'granted') {
          new Notification(payload.notification?.title ?? 'Уведомление', {
            body: payload.notification?.body,
            icon: payload.notification?.icon || '/favicon.ico',
          });
        }
      });

      return () => unsubscribe();
    }
  }, []);

  return (
    <>
      <main className="min-h-screen relative overflow-hidden">
        <RegistrationForm />
      </main>
      <NotificationPermission />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  );
}
