import RegistrationForm from '../components/auth/RegistrationForm';
import CryptoBackground from '../components/layout/CryptoBackground';
import type { AppProps } from 'next/app';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Polyfills для React Native Web
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';
import { Component } from 'react';

if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}

export default function HomePage() {
  return (
    <>
      <main className="min-h-screen relative overflow-hidden">
        <RegistrationForm />
      </main>
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
