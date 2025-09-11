"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// ❗ Для стилей кошелька
import "@solana/wallet-adapter-react-ui/styles.css";

type Props = {
  children: React.ReactNode;
};


// Основной провайдер кошельков Solana
export default function WalletProvider({ children }: Props) {
  // ⚙️ Сеть: "devnet" для теста, "mainnet-beta" для продакшена
const network: WalletAdapterNetwork =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) || WalletAdapterNetwork.Devnet;

  // RPC endpoint
  const endpoint = useMemo(() => {
    return network === "mainnet-beta"
      ? clusterApiUrl("mainnet-beta")
      : clusterApiUrl("devnet");
  }, [network]);

  // Список поддерживаемых кошельков
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network })
      // сюда можно добавить ещё кошельки
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
