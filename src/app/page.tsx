'use client';

import { useEffect } from 'react';
import RegistrationForm from '../components/auth/RegistrationForm';
import NotificationPermission from '@/components/auth/NotificationPermission';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Buffer } from 'buffer';
import axios from 'axios';

import { messaging, onMessage } from '@/utils/firebase-config';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

export default function HomePage() {
useEffect(() => {
  if (typeof window !== 'undefined' && messaging) {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);

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
