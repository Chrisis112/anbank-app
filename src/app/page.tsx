'use client';

import RegistrationForm from '../components/auth/RegistrationForm';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Buffer } from 'buffer';
import NotificationPermission from '@/components/auth/NotificationPermission';
// Глобальная настройка Buffer для браузера
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

export default function HomePage() {
  return (
    <>
      <main className="min-h-screen relative overflow-hidden">
        <RegistrationForm />

      </main>
      <NotificationPermission
  onToken={async (token) => {
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        console.warn('No auth token, user not authenticated');
        return;
      }
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });
      console.log('Push token saved to server');
    } catch (error) {
      console.error('Failed to save push token on server', error);
    }
  }}
/>

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
