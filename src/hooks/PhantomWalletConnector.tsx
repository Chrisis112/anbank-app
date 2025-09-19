'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';

export default function PhantomWalletConnector() {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedKey = localStorage.getItem('phantom_public_key');
    if (savedKey) {
      try {
        setPhantomWalletPublicKey(new PublicKey(savedKey));
      } catch {
        localStorage.removeItem('phantom_public_key');
      }
    }

    // Подписка на событие отключения
    if (window.solana && window.solana.isPhantom) {
      const onDisconnect = () => {
        setPhantomWalletPublicKey(null);
        localStorage.removeItem('phantom_public_key');
      };
      window.solana.on('disconnect', onDisconnect);

      return () => {
        window.solana.removeListener('disconnect', onDisconnect);
      };
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.solana?.isPhantom) {
      throw new Error('Phantom Wallet не установлен');
    }
    try {
      setIsConnecting(true);
      const response = await window.solana.connect();
      const publicKey = new PublicKey(response.publicKey.toString());
      setPhantomWalletPublicKey(publicKey);
      localStorage.setItem('phantom_public_key', publicKey.toString());
    } catch (error) {
      console.error('Ошибка подключения к Phantom:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        await window.solana.disconnect(); // Ждем реального отключения от Phantom
      } catch (error) {
        console.error('Ошибка отключения:', error);
      }
    }
    // После отключения состояние почистится через событие 'disconnect' выше
  }, []);

  return {
    phantomWalletPublicKey,
    isConnected: !!phantomWalletPublicKey,
    isConnecting,
    connectWallet,
    disconnectWallet,
  };
}
