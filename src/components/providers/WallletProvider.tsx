import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
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

interface Props {
  children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
  const network =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK
      ? WalletAdapterNetwork.Mainnet
      : WalletAdapterNetwork.Devnet;

  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK || clusterApiUrl(network);
  }, [network]);

  const mobileWalletAdapter = useMemo(() => {
    return new SolanaMobileWalletAdapter({
      appIdentity: {
        name: 'CryptoChat',
        uri: typeof window !== 'undefined' ? window.location.origin : 'https://app.anbanktoken.com',
      },
      authorizationResultCache: new SimpleAuthorizationResultCache(),
      addressSelector: createDefaultAddressSelector(),
      chain: network === WalletAdapterNetwork.Mainnet ? 'mainnet-beta' : 'devnet', // используем chain вместо cluster
      onWalletNotFound: async () => {
        alert('Solana Mobile Wallet не найден! Пожалуйста, установите его.');
      },
    });
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter(),
      mobileWalletAdapter,
    ],
    [network, mobileWalletAdapter]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
