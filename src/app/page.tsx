'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import RegistrationForm from '../components/auth/RegistrationForm';
import NotificationPermission from '@/components/auth/NotificationPermission';
import { Buffer } from 'buffer';
import { messaging, onMessage, getToken } from '@/utils/firebase-config';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
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

  // Обработка foreground сообщений с показом toast и навигацией по клику
  useEffect(() => {
    if (typeof window !== 'undefined' && messaging) {
      const unsubscribe = onMessage(messaging, async (payload) => {
        const notifId = payload.messageId || (payload.notification && (payload.notification as any).tag);
        if (notifId && seenNotifications.current.has(notifId)) {
          console.log('Duplicate notification ignored', notifId);
          return;
        }
        if (notifId) seenNotifications.current.add(notifId);

        if (Notification.permission === 'granted') {
          const title = payload.notification?.title ?? 'Уведомление';
          const body = payload.notification?.body ?? '';

          // Допустим, в data есть поле otherUserId для ЛС
          const otherUserId = payload.data?.otherUserId;

          // Функция перехода в ЛС
          async function openPrivateChat(userId: string) {
            try {
              if (!authToken) throw new Error("No auth token");

              const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/private/chats/create-or-get`,
                { otherUserId: userId },
                { headers: { Authorization: `Bearer ${authToken}` } }
              );

              const chatId = res.data?.chatId;
              if (chatId) {
                router.push(`/chat/${chatId}`);
              } else {
                router.push('/chat');
              }
            } catch (err) {
              console.error("Failed to open private chat", err);
              router.push('/chat');
            }
          }

          // Показываем toast с обработкой клика
          toast.info(
            <div style={{ cursor: 'pointer' }}>
              <strong>{title}</strong>
              <div>{body}</div>
            </div>,
            {
              onClick: () => {
                window.focus();
                if (otherUserId) {
                  openPrivateChat(otherUserId);
                } else {
                  router.push('/chat');
                }
                toast.dismiss();
              },
              autoClose: 5000,
              closeOnClick: true,
            }
          );

          // Создаем нативное уведомление
          const notification = new Notification(title, {
            body,
            icon: payload.notification?.icon || '/favicon.ico',
          });

          notification.onclick = () => {
            window.focus();
            if (otherUserId) {
              openPrivateChat(otherUserId);
            } else {
              router.push('/chat');
            }
            notification.close();
          };
        }
      });

      return () => unsubscribe();
    }
  }, [router, authToken]);

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
