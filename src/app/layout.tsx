'use client';

import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';

import '@solana/wallet-adapter-react-ui/styles.css';

import React from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  AuthorizationResultCache,
} from '@solana-mobile/wallet-adapter-mobile';

class SimpleAuthorizationResultCache implements AuthorizationResultCache {
  async get() {
    return null;
  }
  async set() {}
  async delete() {}
  async clear() {}
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const network =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'https://api.mainnet-beta.solana.com'
      ? WalletAdapterNetwork.Mainnet
      : WalletAdapterNetwork.Devnet;

  const endpoint = process.env.NEXT_PUBLIC_SOLANA_NETWORK || clusterApiUrl(network);

  const mobileWalletAdapter = React.useMemo(() => {
    return new SolanaMobileWalletAdapter({
      appIdentity: {
        name: 'CryptoChat',
        uri: typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com',
      },
      authorizationResultCache: new SimpleAuthorizationResultCache(),
      addressSelector: createDefaultAddressSelector(),
      chain: network === WalletAdapterNetwork.Mainnet ? 'mainnet-beta' : 'devnet',
      onWalletNotFound: async () => {
        alert('Solana Mobile Wallet не найден! Пожалуйста, установите его.');
      },
    });
  }, [network]);

  const wallets = React.useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter(),
      mobileWalletAdapter, // добавлен адаптер для мобильных
    ],
    [network, mobileWalletAdapter]
  );

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link
          href="https://fonts.googleapis.com/css?family=Orbitron:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0057ff" />
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
            <WalletModalProvider>{children}</WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}
