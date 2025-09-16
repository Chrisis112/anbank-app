import React, { FC, ReactNode, useMemo } from 'react';
import {
  clusterApiUrl,
} from '@solana/web3.js';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

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

interface Props {
  children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.toLowerCase() || '';
  const isMainnet = rpcUrl.includes('mainnet') || rpcUrl.includes('solana-mainnet');

  // Используем кастомный RPC или дефолтный для mainnet/devnet
  const endpoint = rpcUrl || (isMainnet ? 'https://api.mainnet-beta.solana.com' : clusterApiUrl(WalletAdapterNetwork.Devnet));

  const mobileWalletAdapter = useMemo(() => {
    return new SolanaMobileWalletAdapter({
      appIdentity: {
        name: 'CryptoChat',
        uri: typeof window !== 'undefined' ? window.location.origin : 'https://app.anbanktoken.com',
      },
      authorizationResultCache: new SimpleAuthorizationResultCache(),
      addressSelector: createDefaultAddressSelector(),
      chain: isMainnet ? 'mainnet-beta' : 'devnet',  // ОБЯЗАТЕЛЬНО mainnet-beta для mainnet
      onWalletNotFound: async () => {
        alert('Solana Mobile Wallet не найден! Пожалуйста, установите его.');
      },
    });
  }, [isMainnet]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      mobileWalletAdapter,
    ],
    [mobileWalletAdapter]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
