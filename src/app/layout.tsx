'use client';

import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';

import '@solana/wallet-adapter-react-ui/styles.css';

import React, { useEffect, useRef } from 'react';
import { WalletContextProvider } from '@/components/providers/WalletProvider';
import { messaging, onMessage } from '@/utils/firebase-config';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useRouter } from 'next/navigation';


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const seenNotifications = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window !== 'undefined' && messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        const notifId = payload.messageId || (payload.notification && (payload.notification as any).tag);
        if (notifId && seenNotifications.current.has(notifId)) {
          console.log('Duplicate notification ignored', notifId);
          return;
        }
        if (notifId) seenNotifications.current.add(notifId);

        if (Notification.permission === 'granted') {
          const title = payload.notification?.title ?? 'Уведомление';
          const body = payload.notification?.body ?? '';
          const chatUrl = '/chat'; // жестко переходим в /chat

          toast.info(
            <div style={{ cursor: 'pointer' }}>
              <strong>{title}</strong>
              <div>{body}</div>
            </div>,
            {
              onClick: () => {
                window.focus();
                router.push(chatUrl);
                toast.dismiss();
              },
              autoClose: 5000,
              closeOnClick: true,
            }
          );

          const notification = new Notification(title, {
            body,
            icon: payload.notification?.icon || '/favicon.ico',
          });

          notification.onclick = () => {
            window.focus();
            router.push(chatUrl);
            notification.close();
          };
        }
      });

      return () => unsubscribe();
    }
  }, [router]);

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link
          href="https://fonts.googleapis.com/css?family=Orbitron:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0057ff" />
      </head>
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
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
      </body>
    </html>
  );
}
