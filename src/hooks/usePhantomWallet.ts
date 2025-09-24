import { useState, useEffect, useCallback } from "react";

interface PhantomProvider {
  publicKey: any | null;
  isPhantom: boolean;
  connect: () => Promise<{ publicKey: any }>;
  disconnect: () => Promise<void>;
  on: (event: string, handler: () => void) => void;
  removeListener: (event: string, handler: () => void) => void;
  signTransaction: (tx: any) => Promise<any>;
}

export function usePhantomWallet() {
  const [phantomWallet, setPhantomWallet] = useState<PhantomProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.solana?.isPhantom) {
      window.solana.connect({ onlyIfTrusted: true }).then((resp: { publicKey: any; }) => {
        if (resp.publicKey) {
          setPhantomWallet(window.solana);
        }
      }).catch(() => {});
      const onDisconnect = () => setPhantomWallet(null);
      window.solana.on("disconnect", onDisconnect);
      return () => window.solana.removeListener("disconnect", onDisconnect);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined" || !window.solana?.isPhantom) {
      throw new Error("Phantom Wallet не установлен");
    }
    try {
      setIsConnecting(true);
      const response = await window.solana.connect();
      if (response.publicKey) {
        setPhantomWallet(window.solana);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    if (phantomWallet) {
      try {
        await phantomWallet.disconnect();
        setPhantomWallet(null);
      } catch (error) {
        console.error("Ошибка отключения:", error);
      }
    }
  }, [phantomWallet]);

  return { phantomWallet, isConnected: !!phantomWallet, isConnecting, connectWallet, disconnectWallet };
}
