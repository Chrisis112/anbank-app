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
    if (storedSecret) setSharedSecret(bs58.decode(storedSecret));
  }, []);

  // Обработка deeplinks для мобильных устройств
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PHANTOM_DEEPLINK') {
        handleDeepLink(event.data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dappKeyPair, isMobile]);

  const handleDeepLink = useCallback(async (url: string) => {
    if (!dappKeyPair) return;

    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);

      if (params.get('errorCode')) {
        const error = Object.fromEntries([...params]);
        const message = error?.errorMessage ?? 'Unknown error';
        console.error('Phantom error:', message);
        setIsConnecting(false);
        return;
      }

      if (urlObj.pathname.includes('onConnect')) {
        const sharedSecretDapp = nacl.box.before(
          bs58.decode(params.get('phantom_encryption_public_key')!),
          dappKeyPair.secretKey
        );

        const connectData = decryptPayload(
          params.get('data')!,
          params.get('nonce')!,
          sharedSecretDapp
        );

        setSharedSecret(sharedSecretDapp);
        setSession(connectData.session);
        setPhantomWalletPublicKey(new PublicKey(connectData.public_key));

        localStorage.setItem('phantom_public_key', connectData.public_key);
        localStorage.setItem('phantom_session', connectData.session);
        localStorage.setItem('phantom_shared_secret', bs58.encode(sharedSecretDapp));

        console.log(`Connected to Phantom: ${connectData.public_key}`);
        setIsConnecting(false);
      }

      if (urlObj.pathname.includes('onDisconnect')) {
        disconnectWallet();
      }
    } catch (error) {
      console.error('Error processing deeplink:', error);
      setIsConnecting(false);
    }
  }, [dappKeyPair]);

  const connectWallet = useCallback(async () => {
  try {
    setIsConnecting(true);

    const isMobile = typeof window !== 'undefined'
      ? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      : false;

    if (!isMobile && typeof window !== 'undefined' && window.solana?.isPhantom) {
      // Десктоп — вызываем connect расширения Phantom
      const resp = await window.solana.connect();
      setPhantomWalletPublicKey(new PublicKey(resp.publicKey.toString()));
      localStorage.setItem('phantom_public_key', resp.publicKey.toString());
      setIsConnecting(false);
      return;
    }

    if (isMobile && dappKeyPair) {
      // Мобильные устройства — open deeplink для подключения
      const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
        cluster: 'mainnet-beta',
        app_url: window.location.origin,
        redirect_link: `${window.location.origin}/phantom-redirect?action=connect`,
      });

      const connectUrl = `https://phantom.app/ul/v1/connect?${params.toString()}`;

      window.open(connectUrl, '_blank');
      
      // Здесь поставьте setTimeout или другую логику если нужно управлять состоянием
      setIsConnecting(false);
      return;
    }

    throw new Error('Phantom Wallet не доступен');

  } catch (error) {
    console.error('Error connecting to Phantom:', error);
    setIsConnecting(false);
  }
}, [dappKeyPair]);

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