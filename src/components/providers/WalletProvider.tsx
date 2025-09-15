// components/WalletProviders.tsx
import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles for wallet modal
require('@solana/wallet-adapter-react-ui/styles.css');

const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';

interface WalletProvidersProps {
  children: ReactNode;
}

export const WalletProviders: FC<WalletProvidersProps> = ({ children }) => {
  // Determine network endpoint
  const endpoint = useMemo(() => {
    if (SOLANA_NETWORK.includes('mainnet')) {
      return clusterApiUrl('mainnet-beta');
    } else if (SOLANA_NETWORK.includes('testnet')) {
      return clusterApiUrl('testnet');
    } else if (SOLANA_NETWORK.includes('devnet')) {
      return clusterApiUrl('devnet');
    }
    return SOLANA_NETWORK;
  }, []);

  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProviders;