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
      <NotificationPermission/>
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
