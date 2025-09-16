'use client';

import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';

import React, { ReactNode, useMemo } from 'react';

import '@solana/wallet-adapter-react-ui/styles.css';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link
          href="https://fonts.googleapis.com/css?family=Orbitron:wght@500;700&display=swap"
          rel="stylesheet"
        />
        {/* При необходимости можно добавить мета-теги для темы PWA */}
        <meta name="theme-color" content="#0057ff" />
        {/* Регистрация service worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js');
              }
            `,
          }}
        />
      </head>
      <body>
              {children}
      </body>
    </html>
  );
}
