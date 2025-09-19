'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';  // Импорт как namespace
import bs58 from 'bs58';
import { decryptPayload } from '@/utils/decryptPayload';
import { toast } from 'react-toastify';

interface PhantomWalletConnectorReturn {
  phantomWalletPublicKey: PublicKey | null;
  isConnected: boolean;
  isConnecting: boolean;
  setPhantomWalletPublicKey: (key: PublicKey | null) => void;
  session: string | undefined;
  setSession: (session: string | undefined) => void;
  sharedSecret: Uint8Array | undefined;
  setSharedSecret: (secret: Uint8Array | undefined) => void;
  dappPair: nacl.BoxKeyPair | null;
  connectWallet: () => Promise<void>;
  disconnect: () => void;
}

export default function PhantomWalletConnector(): PhantomWalletConnectorReturn {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<string | undefined>(undefined);
  const [sharedSecret, setSharedSecret] = useState<Uint8Array | undefined>(undefined);
  const [dappPair, setDappPair] = useState<nacl.BoxKeyPair | null>(null);

  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Инициализация dappPair один раз
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem('dapp_PublicKeySecret');
    try {
      if (saved) {
        const secretKey = bs58.decode(saved);
        setDappPair({
          secretKey,
          publicKey: secretKey.slice(32,64),// исправлено на правильный срез публичного ключа (32-64)
        });
        console.log('Restored dappPair from localStorage');
      } else {
        const newPair = nacl.box.keyPair();
        localStorage.setItem('dapp_PublicKeySecret', bs58.encode(newPair.secretKey));
        setDappPair(newPair);
        console.log('Generated new dappPair and saved to localStorage');
      }
    } catch (error) {
      const newPair = nacl.box.keyPair();
      localStorage.setItem('dapp_PublicKeySecret', bs58.encode(newPair.secretKey));
      setDappPair(newPair);
      console.log('Error restoring dappPair, generated new one', error);
    }
  }, []);

  // Восстановление подключения и сессии
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pubKeyStr = localStorage.getItem('phantom_public_key');
    const sessionStr = localStorage.getItem('phantom_session');
    const secretStr = localStorage.getItem('phantom_shared_secret');

    if (pubKeyStr) {
      try {
        setPhantomWalletPublicKey(new PublicKey(pubKeyStr));
        console.log('Restored phantomWalletPublicKey from localStorage:', pubKeyStr);
      } catch (error) {
        localStorage.removeItem('phantom_public_key');
        setPhantomWalletPublicKey(null);
        console.error('Error restoring phantomWalletPublicKey', error);
      }
    }
    if (sessionStr) {
      setSession(sessionStr);
      console.log('Restored session:', sessionStr);
    }
    if (secretStr) {
      try {
        setSharedSecret(bs58.decode(secretStr));
        console.log('Restored sharedSecret from localStorage');
      } catch {
        localStorage.removeItem('phantom_shared_secret');
        setSharedSecret(undefined);
        console.error('Error decoding sharedSecret, removed from localStorage');
      }
    }
  }, []);

  // Отслеживание возврата из Phantom на мобилке
  useEffect(() => {
    if (!isMobile) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && isConnecting) {
        console.log('User returned to app, checking connection state...');
        setTimeout(() => {
          const pubKeyStr = localStorage.getItem('phantom_public_key');
          const sessionStr = localStorage.getItem('phantom_session');

          if (pubKeyStr && sessionStr) {
            try {
              setPhantomWalletPublicKey(new PublicKey(pubKeyStr));
              setSession(sessionStr);
              console.log('Updated connection state on return from Phantom');
              setIsConnecting(false);
            } catch (error) {
              console.error('Error setting up connection on return', error);
              setIsConnecting(false);
            }
          } else {
            console.log('No connection info found on return; cancelling connection');
            setTimeout(() => setIsConnecting(false), 2000);
          }
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isMobile, isConnecting]);

  // Функция подключения
  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);
      console.log('Starting wallet connection...');

      if (!isMobile && typeof window !== 'undefined' && window.solana?.isPhantom) {
        console.log('Connecting to Phantom extension on desktop');
        const resp = await window.solana.connect();
        setPhantomWalletPublicKey(new PublicKey(resp.publicKey.toString()));
        localStorage.setItem('phantom_public_key', resp.publicKey.toString());
        setIsConnecting(false);
        console.log('Phantom desktop wallet connected');
        return;
      }

      if (isMobile && dappPair) {
        console.log('Starting Phantom mobile deeplink flow');
        const params = new URLSearchParams({
          dapp_encryption_public_key: bs58.encode(dappPair.publicKey),
          cluster: 'devnet', // замените на 'mainnet' в продакшене
          app_url: window.location.origin,
          redirect_link: `${window.location.origin}/phantom-redirect?action=connect`,
        });

        const url = `https://phantom.app/ul/v1/connect?${params.toString()}`;
        console.log('Redirecting to Phantom deeplink:', url);
        window.location.href = url;  // использование location.href для мобилок

        // оставляем isConnecting равным true, сбросит возвращение из Phantom
        return;
      }

      throw new Error('Phantom Wallet не обнаружен');

    } catch (error) {
      console.error('Ошибка подключения кошелька', error);
      setIsConnecting(false);
      toast.error('Не удалось подключить Phantom Wallet');
    }
  }, [dappPair, isMobile]);

  const disconnect = useCallback(() => {
    setPhantomWalletPublicKey(null);
    setSession(undefined);
    setSharedSecret(undefined);
    localStorage.removeItem('phantom_public_key');
    localStorage.removeItem('phantom_session');
    localStorage.removeItem('phantom_shared_secret');
    setIsConnecting(false);
    console.log('Wallet disconnected');
  }, []);

  return {
    phantomWalletPublicKey,
    isConnected: !!phantomWalletPublicKey,
    isConnecting,
    setPhantomWalletPublicKey,
    session,
    setSession,
    sharedSecret,
    setSharedSecret,
    dappPair,
    connectWallet,
    disconnect,
  };
}
