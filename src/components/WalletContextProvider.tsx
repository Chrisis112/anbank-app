// components/WalletContextProvider.tsx
'use client';

import React, { ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextProviderProps {
  children: ReactNode;
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
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
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default WalletContextProvider;
