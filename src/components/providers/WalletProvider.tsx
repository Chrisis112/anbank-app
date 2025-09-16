import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  AuthorizationResultCache,
} from '@solana-mobile/wallet-adapter-mobile';

class SimpleAuthorizationResultCache implements AuthorizationResultCache {
  async get() { return null; }
  async set() {}
  async delete() {}
  async clear() {}
}

interface Props {
  children: ReactNode;
}
export const WalletContextProvider: FC<Props> = ({ children }) => {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK || '';
  const isMainnet = rpcUrl.toLowerCase().includes('mainnet') || rpcUrl.toLowerCase().includes('solana-mainnet');

  const mobileWalletAdapter = useMemo(() => {
    return new SolanaMobileWalletAdapter({
      appIdentity: {
        name: 'CryptoChat',
        uri: typeof window !== 'undefined' ? window.location.origin : 'https://app.anbanktoken.com',
      },
      authorizationResultCache: new SimpleAuthorizationResultCache(),
      addressSelector: createDefaultAddressSelector(),
      chain: isMainnet ? 'mainnet-beta' : 'devnet',
      onWalletNotFound: async () => {
        alert('Solana Mobile Wallet не найден! Пожалуйста, установите его.');
      },
    });
  }, [isMainnet]);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    mobileWalletAdapter,
  ], [mobileWalletAdapter]);

  // Формируем wsEndpoint из rpcUrl, если возможно
  const wsEndpoint = rpcUrl.startsWith('https://')
    ? rpcUrl.replace(/^https:\/\//, 'wss://')
    : undefined;

  return (
    <ConnectionProvider 
      endpoint={rpcUrl}
      config={wsEndpoint ? { wsEndpoint } : {}}
    >
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
