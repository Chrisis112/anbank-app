'use client';

import RegistrationForm from '../components/auth/RegistrationForm';
import NotificationPermission from '@/components/auth/NotificationPermission';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Buffer } from 'buffer';
import axios from 'axios';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

export default function HomePage() {
  const handleToken = async (token: string) => {
    const authToken = localStorage.getItem('token');
    if (!authToken) return;

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users/push-token`,
        { token },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      console.log('Push token saved on server');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  };

  return (
    <>
      <main className="min-h-screen relative overflow-hidden">
        <RegistrationForm />
      </main>
      <NotificationPermission onToken={handleToken} />
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
