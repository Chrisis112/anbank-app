import React, { FC, ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SolanaMobileWalletAdapter, createDefaultAddressSelector, AuthorizationResultCache, LocalSolanaMobileWalletAdapter } from '@solana-mobile/wallet-adapter-mobile';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

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
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';

const isDevnet = rpcUrl.includes('devnet');

const mobileWalletAdapter = useMemo(() => new SolanaMobileWalletAdapter({
  appIdentity: { name: 'CryptoChat', uri: typeof window !== 'undefined' ? window.location.origin : undefined },
  authorizationResultCache: new SimpleAuthorizationResultCache(),
  addressSelector: createDefaultAddressSelector(),
  cluster: isDevnet ? 'devnet' : 'mainnet-beta',
  onWalletNotFound: async (_adapter) => { alert('Solana Mobile Wallet не найден!'); }
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
