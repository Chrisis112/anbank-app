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
