'use client';

import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';

import '@solana/wallet-adapter-react-ui/styles.css';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter } from '@solana/wallet-adapter-wallets';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Создаем массив кошельков
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet }),
    new TorusWalletAdapter(),
  ];

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
        <WalletProvider wallets={wallets} autoConnect>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
