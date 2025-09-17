'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import * as Linking from 'expo-linking';
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
  const [deepLink, setDeepLink] = useState<string>('');
  const [dappKeyPair, setDappKeyPair] = useState<nacl.BoxKeyPair | null>(null);

  // Инициализация dappKeyPair один раз
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

  // Восстановление публичного ключа, сессии и sharedSecret из localStorage при монтировании
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedKey = localStorage.getItem('phantom_public_key');
    const storedSession = localStorage.getItem('phantom_session');
    const storedSharedSecret = localStorage.getItem('phantom_shared_secret');

    if (storedKey) {
      try {
        setPhantomWalletPublicKey(new PublicKey(storedKey));
      } catch {
        localStorage.removeItem('phantom_public_key');
        setPhantomWalletPublicKey(null);
      }
    }

    if (storedSession) {
      setSession(storedSession);
    }

    if (storedSharedSecret) {
      try {
        setSharedSecret(bs58.decode(storedSharedSecret));
      } catch {
        localStorage.removeItem('phantom_shared_secret');
        setSharedSecret(undefined);
      }
    }
  }, []);

  const onConnectRedirectLink = Linking.createURL('onConnect');
  const onDisconnectRedirectLink = Linking.createURL('onDisconnect');

  const handleDeepLink = useCallback(({ url }: { url: string }) => {
    setDeepLink(url);
  }, []);

  useEffect(() => {
    const initializeDeeplinks = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) setDeepLink(initialUrl);
    };
    initializeDeeplinks();

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription?.remove();
  }, [handleDeepLink]);

  useEffect(() => {
    if (!deepLink || !dappKeyPair) return;

    try {
      const url = new URL(deepLink);
      const params = url.searchParams;

      if (params.get('errorCode')) {
        const error = Object.fromEntries([...params]);
        const message = error?.errorMessage ?? 'Unknown error';
        console.error('Phantom error:', message);
        setIsConnecting(false);
        return;
      }

      if (/onConnect/.test(url.pathname)) {
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
        setIsConnecting(false);
        console.log(`Connected to Phantom: ${connectData.public_key}`);

        // Сохраняем в localStorage для перезагрузок
        localStorage.setItem('phantom_public_key', connectData.public_key);
        localStorage.setItem('phantom_session', connectData.session);
        localStorage.setItem('phantom_shared_secret', bs58.encode(sharedSecretDapp));

        return;
      }

      if (/onDisconnect/.test(url.pathname)) {
        setPhantomWalletPublicKey(null);
        setSession(undefined);
        setSharedSecret(undefined);

        localStorage.removeItem('phantom_public_key');
        localStorage.removeItem('phantom_session');
        localStorage.removeItem('phantom_shared_secret');

        console.log('Disconnected from Phantom');
        return;
      }
    } catch (error) {
      console.error('Error processing deeplink:', error);
      setIsConnecting(false);
    }
  }, [deepLink, dappKeyPair]);

  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);

      if (typeof window !== 'undefined' && window.solana?.isPhantom) {
        const resp = await window.solana.connect();
        setPhantomWalletPublicKey(new PublicKey(resp.publicKey.toString()));
        localStorage.setItem('phantom_public_key', resp.publicKey.toString());

        if (!dappKeyPair) {
          const savedKey = localStorage.getItem('dappKeyPair_secretKey');
          let newDappKeyPair: nacl.BoxKeyPair;
          if (savedKey) {
            const secretKey = bs58.decode(savedKey);
            newDappKeyPair = {
              publicKey: secretKey.slice(0, 32),
              secretKey,
            };
          } else {
            newDappKeyPair = nacl.box.keyPair();
            localStorage.setItem('dappKeyPair_secretKey', bs58.encode(newDappKeyPair.secretKey));
          }
          setDappKeyPair(newDappKeyPair);
        }

        setIsConnecting(false);
      } else {
        if (!dappKeyPair) throw new Error('dappKeyPair не инициализирован');

        const params = new URLSearchParams({
          dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
          cluster: 'mainnet-beta',
          app_url: 'https://app.anbanktoken.com',
          redirect_link: onConnectRedirectLink,
        });
        const connectUrl = `https://phantom.app/ul/v1/connect?${params.toString()}`;
        await Linking.openURL(connectUrl);
      }
    } catch (error) {
      console.error('Error connecting to Phantom:', error);
      setIsConnecting(false);
    }
  }, [dappKeyPair, onConnectRedirectLink]);

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
