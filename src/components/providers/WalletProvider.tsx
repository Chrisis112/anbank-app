import React, { FC, ReactNode, useMemo } from 'react';
import {
  Connection,
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
const isMainnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.toLowerCase().includes('mainnet-beta') ?? false;
const network = isMainnet ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;
const endpoint = useMemo(() => {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK || clusterApiUrl(network);
}, [network])

const mobileWalletAdapter = useMemo(() => {
  return new SolanaMobileWalletAdapter({
    appIdentity: {name: 'CryptoChat',
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
    [network, mobileWalletAdapter]
  );

return (
  <ConnectionProvider endpoint={endpoint}>
    <WalletProvider wallets={wallets} autoConnect={false}>
      <WalletModalProvider>{children}</WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
);
};
