'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';                     // Исправлено: импорт как namespace
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
  dappPair: nacl.BoxKeyPair | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

export default function PhantomWalletConnector(): PhantomWalletConnectorReturn {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<string|undefined>(undefined);
  const [sharedSecret, setSharedSecret] = useState<Uint8Array|undefined>(undefined);
  const [dappPair, setDappPair] = useState<nacl.BoxKeyPair|null>(null);

  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // init dappPair once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem('dapp_PublicKeySecret');

    if (saved) {
      try {
        const secretKey = bs58.decode(saved);
        setDappPair({
          secretKey,
          publicKey: secretKey.slice(0, 32),       // публичный ключ — первые 32 байта
        });
      } catch {
        // если повреждено — сгенерировать заново
        const newPair = nacl.box.keyPair();
        localStorage.setItem('dapp_PublicKeySecret', bs58.encode(newPair.secretKey));
        setDappPair(newPair);
      }
    } else {
      const newPair = nacl.box.keyPair();
      localStorage.setItem('dapp_PublicKeySecret', bs58.encode(newPair.secretKey));
      setDappPair(newPair);
    }
  }, []);

  // Восстановление подключения + сессии из localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pubKeyStr = localStorage.getItem('phantom_public_key');
    const sessionStr = localStorage.getItem('phantom_session');
    const sharedSecretStr = localStorage.getItem('phantom_shared_secret');

    if (pubKeyStr) {
      try {
        setPhantomWalletPublicKey(new PublicKey(pubKeyStr));
      } catch {
        localStorage.removeItem('phantom_public_key');
        setPhantomWalletPublicKey(null);
      }
    }

    if (sessionStr) setSession(sessionStr);

    if (sharedSecretStr) {
      try {
        setSharedSecret(bs58.decode(sharedSecretStr));
      } catch {
        localStorage.removeItem('phantom_shared_secret');
        setSharedSecret(undefined);
      }
    }
  }, []);

  // Обработка возврата с телефона
  useEffect(() => {
    if (!isMobile) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && isConnecting) {
        setTimeout(() => {
          const pubKeyStr = localStorage.getItem('phantom_public_key');
          const sessionStr = localStorage.getItem('phantom_session');

          if (pubKeyStr && sessionStr) {
            try {
              setPhantomWalletPublicKey(new PublicKey(pubKeyStr));
              setSession(sessionStr);
              setIsConnecting(false);
            } catch {
              setIsConnecting(false);
            }
          } else {
            setTimeout(() => setIsConnecting(false), 2000);
          }
        }, 1000);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isMobile, isConnecting]);

  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);

      if (!isMobile && typeof window !== 'undefined' && window.solana?.isPhantom) {
        // desktop: расширение Phantom
        const resp = await window.solana.connect();
        setPhantomWalletPublicKey(new PublicKey(resp.publicKey.toString()));
        localStorage.setItem('phantom_public_key', resp.publicKey.toString());
        setIsConnecting(false);
        return;
      }

      if (isMobile && dappPair) {
        // mobile: deeplink к приложению Phantom Wallet
        const params = new URLSearchParams({
          dapp_encryption_public_key: bs58.encode(dappPair.publicKey),
          cluster: 'mainnet-beta',
          app_url: window.location.origin,
          redirect_link: `${window.location.origin}/phantom-redirect?action=connect`,
        });

        const url = `https://phantom.app/ul/v1/connect?${params.toString()}`;
        window.location.href = url;   // location.href вместо open для устойчивости на мобильных
        // состояние isConnecting останется true — снимется после переключения (обработчик visibilitychange)
        return;
      }

      throw new Error('Phantom Wallet не доступен');

    } catch(e) {
      console.error(e);
      setIsConnecting(false);
    }
  }, [dappPair, isMobile]);

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
    dappPair,
    connectWallet,
    disconnectWallet,
  };
}
