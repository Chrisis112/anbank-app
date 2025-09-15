'use client';

import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';

import React, { ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';

  const endpoint = useMemo(() => {
    if (network.startsWith('http')) return network;
    if (['mainnet-beta', 'devnet', 'testnet'].includes(network)) {
      return clusterApiUrl(network as 'mainnet-beta' | 'devnet' | 'testnet');
    }
    return clusterApiUrl('mainnet-beta');
  }, [network]);

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

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
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              {children}
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}
