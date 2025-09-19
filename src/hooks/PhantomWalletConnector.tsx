'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { decryptPayload } from '@/utils/decryptPayload';

interface PhantomWalletConnectorReturn {
  phantomWalletPublicKey: PublicKey | null;
  isConnected: boolean;
  isConnecting: boolean;
  setPhantomWalletPublicKey: (key: PublicKey | null) => void;
  session: string | undefined;
  setSession: (session: string | undefined) => void;
  sharedSecret: Uint8Array | undefined;
  setSharedSecret: (secret: Uint8Array | undefined) => void;
  dappKeyPair: nacl.BoxKeyPair | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

export default function PhantomWalletConnector(): PhantomWalletConnectorReturn {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<string | undefined>(undefined);
  const [sharedSecret, setSharedSecret] = useState<Uint8Array | undefined>(undefined);
  const [dappKeyPair, setDappKeyPair] = useState<nacl.BoxKeyPair | null>(null);

  const isMobile = typeof window !== 'undefined' 
    ? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    : false;

  // Инициализация dappKeyPair
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('dappKeyPair_secretKey');
      if (saved) {
        const secretKey = bs58.decode(saved);
        setDappKeyPair({
          secretKey,
          publicKey: secretKey.slice(0, 32),
 // Исправлено: правильная длина публичного ключа
        });
      } else {
        const newKeyPair = nacl.box.keyPair();
        localStorage.setItem('dappKeyPair_secretKey', bs58.encode(newKeyPair.secretKey));
        setDappKeyPair(newKeyPair);
      }
    } catch {
      const newKeyPair = nacl.box.keyPair();
      localStorage.setItem('dappKeyPair_secretKey', bs58.encode(newKeyPair.secretKey));
      setDappKeyPair(newKeyPair);
    }
  }, []);

  // Восстановление из localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedPubKey = localStorage.getItem('phantom_public_key');
    const storedSession = localStorage.getItem('phantom_session');
    const storedSecret = localStorage.getItem('phantom_shared_secret');

    if (storedPubKey) {
      try {
        setPhantomWalletPublicKey(new PublicKey(storedPubKey));
      } catch {
        localStorage.removeItem('phantom_public_key');
      }
    }
    if (storedSession) setSession(storedSession);
    if (storedSecret) {
      try {
        setSharedSecret(bs58.decode(storedSecret)); // Исправлено: правильное декодирование
      } catch {
        localStorage.removeItem('phantom_shared_secret');
      }
    }
  }, []);

  // Обработка возврата из Phantom (для мобильных)
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (!document.hidden && isConnecting) {
        // Пользователь вернулся в приложение - проверяем результат подключения
        setTimeout(() => {
          const storedPubKey = localStorage.getItem('phantom_public_key');
          const storedSession = localStorage.getItem('phantom_session');
          
          if (storedPubKey && storedSession) {
            try {
              setPhantomWalletPublicKey(new PublicKey(storedPubKey));
              setSession(storedSession);
              setIsConnecting(false);
            } catch {
              setIsConnecting(false);
            }
          } else {
            // Если данных нет - отменяем подключение
            setTimeout(() => setIsConnecting(false), 2000);
          }
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isMobile, isConnecting]);

const connectWallet = useCallback(async () => {
  try {
    setIsConnecting(true);

    if (!isMobile && typeof window !== 'undefined' && window.solana?.isPhantom) {
      // Десктоп: используем расширение Phantom
      const resp = await window.solana.connect();
      setPhantomWalletPublicKey(new PublicKey(resp.publicKey.toString()));
      localStorage.setItem('phantom_public_key', resp.publicKey.toString());
      setIsConnecting(false);
      return;
    }

    if (isMobile && dappKeyPair) {
      // Мобильные: открываем deeplink для подключения
      const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
        cluster: 'mainnet-beta',
        app_url: window.location.origin,
        redirect_link: `${window.location.origin}/phantom-redirect?action=connect`,
      });

      const connectUrl = `https://phantom.app/ul/v1/connect?${params.toString()}`;

      // Для лучшей совместимости на мобильных используйте location.href
      window.location.href = connectUrl;

      // Состояние isConnecting останется true до возврата из кошелька
      return;
    }

    throw new Error('Phantom Wallet не доступен');
  } catch (error) {
    console.error('Ошибка подключения к Phantom:', error);
    setIsConnecting(false);
  }
}, [dappKeyPair, isMobile]);

  const disconnectWallet = useCallback(() => {
    setPhantomWalletPublicKey(null);
    setSession(undefined);
    setSharedSecret(undefined);

    localStorage.removeItem('phantom_public_key');
    localStorage.removeItem('phantom_session');
    localStorage.removeItem('phantom_shared_secret');

    setIsConnecting(false);
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
    dappKeyPair,
    connectWallet,
    disconnectWallet,
  };
}
