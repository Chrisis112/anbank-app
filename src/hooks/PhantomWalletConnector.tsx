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
  dappKeyPair: nacl.BoxKeyPair;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

export default function PhantomWalletConnector(): PhantomWalletConnectorReturn {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<string>();
  const [sharedSecret, setSharedSecret] = useState<Uint8Array>();
  const [deepLink, setDeepLink] = useState<string>('');
  // Инициализация dappKeyPair из localStorage или генерация нового
  const [dappKeyPair, setDappKeyPair] = useState<nacl.BoxKeyPair>(() => {
    try {
      const saved = localStorage.getItem('dappKeyPair_secretKey');
      if (saved) {
        const secretKey = bs58.decode(saved);
        return {
          publicKey: secretKey.slice(32),
          secretKey,
        };
      }
    } catch {
      // Игнорируем ошибки
    }
    const newKeyPair = nacl.box.keyPair();
    localStorage.setItem('dappKeyPair_secretKey', bs58.encode(newKeyPair.secretKey));
    return newKeyPair;
  });

  // Создание redirect ссылок
  const onConnectRedirectLink = Linking.createURL('onConnect');
  const onDisconnectRedirectLink = Linking.createURL('onDisconnect');

  // Обработчик deeplinks
  const handleDeepLink = useCallback(({ url }: { url: string }) => {
    setDeepLink(url);
  }, []);

  // Инициализация deeplink слушателя
  useEffect(() => {
    const initializeDeeplinks = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        setDeepLink(initialUrl);
      }
    };
    initializeDeeplinks();
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription?.remove();
    };
  }, [handleDeepLink]);

  // Обработка входящих deeplinks
  useEffect(() => {
    if (!deepLink) return;

    try {
      const url = new URL(deepLink);
      const params = url.searchParams;

      // Обработка ошибок от Phantom
      if (params.get('errorCode')) {
        const error = Object.fromEntries([...params]);
        const message = error?.errorMessage ?? 'Unknown error';
        console.error('Phantom error:', message);
        setIsConnecting(false);
        return;
      }

      // Обработка успешного подключения
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

      // Обработка отключения
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
  }, [deepLink, dappKeyPair.secretKey]);

  // Функция подключения к Phantom
  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);
      const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
        cluster: 'mainnet-beta',
        app_url: 'https://app.anbanktoken.com',
        redirect_link: onConnectRedirectLink,
      });
      const connectUrl = `https://phantom.app/ul/v1/connect?${params.toString()}`;
      await Linking.openURL(connectUrl);
    } catch (error) {
      console.error('Error connecting to Phantom:', error);
      setIsConnecting(false);
    }
  }, [dappKeyPair.publicKey, onConnectRedirectLink]);

  // Функция отключения от Phantom
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
