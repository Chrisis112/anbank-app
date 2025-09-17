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
  session: string | undefined;
  sharedSecret: Uint8Array | undefined;
  dappKeyPair: nacl.BoxKeyPair | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

export default function PhantomWalletConnector(): PhantomWalletConnectorReturn {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<string>();
  const [sharedSecret, setSharedSecret] = useState<Uint8Array>();
  const [deepLink, setDeepLink] = useState<string>('');
  const [dappKeyPair, setDappKeyPair] = useState<nacl.BoxKeyPair | null>(null);

  // Генерация/загрузка dappKeyPair только на клиенте
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('dappKeyPair_secretKey');
      if (saved) {
        const secretKey = bs58.decode(saved);
        setDappKeyPair({
          secretKey,
          publicKey: secretKey.slice(32),
        });
      } else {
        const newKeyPair = nacl.box.keyPair();
        localStorage.setItem('dappKeyPair_secretKey', bs58.encode(newKeyPair.secretKey));
        setDappKeyPair(newKeyPair);
      }
    } catch {
      // Если ошибка, создадим новый ключ
      const newKeyPair = nacl.box.keyPair();
      localStorage.setItem('dappKeyPair_secretKey', bs58.encode(newKeyPair.secretKey));
      setDappKeyPair(newKeyPair);
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
      if (initialUrl) {
        setDeepLink(initialUrl);
      }
    };
    initializeDeeplinks();

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription?.remove();
  }, [handleDeepLink]);

  useEffect(() => {
    if (!deepLink || !dappKeyPair) return; // ждем dappKeyPair

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
        return;
      }

      if (/onDisconnect/.test(url.pathname)) {
        setPhantomWalletPublicKey(null);
        setSession(undefined);
        setSharedSecret(undefined);
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

    // Проверяем, установлен ли Phantom (desktop)
    if (typeof window !== 'undefined' && window.solana?.isPhantom) {
      const resp = await window.solana.connect();
      setPhantomWalletPublicKey(new PublicKey(resp.publicKey.toString()));
      // Здесь нужно реализовать генерацию/получение dappKeyPair и сессии,
      // либо перейти на deeplink flow при необходимости
      setIsConnecting(false);
    } else {
      // Если Phantom не установлен, открываем deeplink или показываем ошибку
     if (!dappKeyPair) {
  throw new Error('dappKeyPair не инициализирован');
}

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
}, [dappKeyPair?.publicKey, onConnectRedirectLink]);

  const disconnectWallet = useCallback(() => {
    setPhantomWalletPublicKey(null);
    setSession(undefined);
    setSharedSecret(undefined);
    setIsConnecting(false);
  }, []);

  return {
    phantomWalletPublicKey,
    isConnected: !!phantomWalletPublicKey,
    isConnecting,
    session,
    sharedSecret,
    dappKeyPair,
    connectWallet,
    disconnectWallet,
  };
}
