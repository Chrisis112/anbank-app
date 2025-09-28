'use client';

import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';

import '@solana/wallet-adapter-react-ui/styles.css';

import React from 'react';
import { WalletContextProvider } from '@/components/providers/WalletProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
      </body>
    </html>
  );
}
