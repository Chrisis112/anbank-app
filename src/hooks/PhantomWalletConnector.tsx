'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
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

  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Инициализация dappKeyPair
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem('dappKeyPair_secretKey');
    try {
      if (saved) {
        const secretKey = bs58.decode(saved);
        setDappKeyPair({
          secretKey,
          publicKey: secretKey.slice(32, 64), // публичный ключ - вторые 32 байта
        });
        console.log('Restored dappKeyPair from localStorage');
      } else {
        const newPair = nacl.box.keyPair();
        localStorage.setItem('dappKeyPair_secretKey', bs58.encode(newPair.secretKey));
        setDappKeyPair(newPair);
        console.log('Generated new dappKeyPair');
      }
    } catch (error) {
      const newPair = nacl.box.keyPair();
      localStorage.setItem('dappKeyPair_secretKey', bs58.encode(newPair.secretKey));
      setDappKeyPair(newPair);
      console.log('Error restoring dappKeyPair, generated new one', error);
    }
  }, []);

  // Восстановление подключения
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pubKeyStr = localStorage.getItem('phantom_public_key');
    const sessionStr = localStorage.getItem('phantom_session');
    const secretStr = localStorage.getItem('phantom_shared_secret');

    if (pubKeyStr) {
      try {
        setPhantomWalletPublicKey(new PublicKey(pubKeyStr));
        console.log('Restored phantomWalletPublicKey:', pubKeyStr);
      } catch (error) {
        localStorage.removeItem('phantom_public_key');
        setPhantomWalletPublicKey(null);
        console.error('Error restoring phantomWalletPublicKey', error);
      }
    }
    if (sessionStr) {
      setSession(sessionStr);
      console.log('Restored session');
    }
    if (secretStr) {
      try {
        setSharedSecret(bs58.decode(secretStr));
        console.log('Restored sharedSecret');
      } catch {
        localStorage.removeItem('phantom_shared_secret');
        setSharedSecret(undefined);
        console.error('Error decoding sharedSecret');
      }
    }
  }, []);

  // Отслеживание возврата из Phantom на мобильных
  useEffect(() => {
    if (!isMobile) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && isConnecting) {
        console.log('User returned to app, checking connection...');
        setTimeout(() => {
          const pubKeyStr = localStorage.getItem('phantom_public_key');
          const sessionStr = localStorage.getItem('phantom_session');

          if (pubKeyStr && sessionStr) {
            try {
              setPhantomWalletPublicKey(new PublicKey(pubKeyStr));
              setSession(sessionStr);
              console.log('Connection established after return from Phantom');
              setIsConnecting(false);
            } catch (error) {
              console.error('Error setting up connection on return', error);
              setIsConnecting(false);
            }
          } else {
            console.log('No connection info found, cancelling connection');
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
      console.log('Starting wallet connection...');

      // Desktop flow
      if (!isMobile && typeof window !== 'undefined' && window.solana?.isPhantom) {
        console.log('Connecting to Phantom extension on desktop');
        const resp = await window.solana.connect();
        setPhantomWalletPublicKey(new PublicKey(resp.publicKey.toString()));
        localStorage.setItem('phantom_public_key', resp.publicKey.toString());
        setIsConnecting(false);
        console.log('Phantom desktop wallet connected');
        return;
      }

      // Mobile flow
      if (isMobile && dappKeyPair) {
        console.log('Starting Phantom mobile deeplink flow');
        const params = new URLSearchParams({
          dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
          cluster: 'mainnet-beta',
          app_url: window.location.origin,
          redirect_link: `${window.location.origin}/phantom-redirect?action=connect`,
        });

        const url = `https://phantom.app/ul/v1/connect?${params.toString()}`;
        console.log('Redirecting to Phantom deeplink:', url);
        window.location.href = url;
        return;
      }

      throw new Error('Phantom Wallet не доступен');

    } catch (error) {
      console.error('Ошибка подключения кошелька', error);
      setIsConnecting(false);
      toast.error('Не удалось подключить Phantom Wallet');
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
    dappKeyPair,
    connectWallet,
    disconnectWallet,
  };
}
