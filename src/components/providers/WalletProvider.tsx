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
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.toLowerCase() || '';
  const isMainnet = rpcUrl.includes('mainnet') || rpcUrl.includes('solana-mainnet');
  const endpoint = 'https://solana-mainnet.api.syndica.io/api-key/3pfZ59roe79KJVrUGQS2umc9AQkxbPhPwziRo5GBdofqyGF6NKjzk2quzFzNZj21o24ioLoauszYGedJfy3za7uouytyXHvKoNv';

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

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
