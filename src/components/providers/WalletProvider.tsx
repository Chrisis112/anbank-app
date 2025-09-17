import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  AuthorizationResultCache,
} from '@solana-mobile/wallet-adapter-mobile';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Опишите тип Authorization локально в вашем проекте

export interface Authorization {
  accounts: Array<any>;
  auth_token: string;
  wallet_uri_base: string;
  sign_in_result?: {
    address: string;
    signed_message: string;
    signature: string;
    signature_type?: string;
  };
}


class SimpleAuthorizationResultCache implements AuthorizationResultCache {
  async get(): Promise<Authorization | undefined> {
    // Возвращаем undefined вместо null для отсутствующего кэша
    return undefined;
  }
  async set(_authorization: Authorization): Promise<void> {
    // Заглушка
  }
  async delete(): Promise<void> {
    // Заглушка
  }
  async clear(): Promise<void> {
    // Заглушка
  }
}

interface Props {
  children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';
  const isDevnet = rpcUrl.includes('devnet');

  const mobileWalletAdapter = useMemo(() => new SolanaMobileWalletAdapter({
    appIdentity: {
      name: 'CryptoChat',
      uri: typeof window !== 'undefined' ? window.location.origin : 'https://app.anbanktoken.com'
    },
    authorizationResultCache: new SimpleAuthorizationResultCache(),
    addressSelector: createDefaultAddressSelector(),
    cluster: isDevnet ? 'devnet' : 'mainnet-beta',
    onWalletNotFound: async (_adapter) => {
      alert('Solana Mobile Wallet не найден! Пожалуйста, установите соответствующее мобильное приложение.');
    },
  }), [rpcUrl]);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    mobileWalletAdapter,
  ], [mobileWalletAdapter]);

  const wsEndpoint = rpcUrl.startsWith('https://')
    ? rpcUrl.replace(/^https:\/\//, 'wss://')
    : undefined;

  return (
    <ConnectionProvider endpoint={rpcUrl} config={wsEndpoint ? { wsEndpoint } : {}}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
