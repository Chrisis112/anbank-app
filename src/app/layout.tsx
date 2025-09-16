'use client';

import './global.css';
import '../styles/crypto-theme.css';
import '../styles/animations.css';
import '../styles/components.css';

import '@solana/wallet-adapter-react-ui/styles.css';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionContext, ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
export default function RootLayout({ children }: { children: React.ReactNode }) {
const endpoint = process.env.NEXT_PUBLIC_SOLANA_NETWORK || clusterApiUrl('mainnet-beta')
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
