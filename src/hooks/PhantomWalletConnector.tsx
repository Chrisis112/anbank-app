import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { decryptPayload } from '@/utils/decryptPayload';
import { encryptPayload } from '@/utils/encryptPayload';
import { buildUrl } from '@/utils/buildUrl';

const onConnectRedirectLink = typeof window !== 'undefined'
  ? `${window.location.origin}/onConnect`
  : '/onConnect';

const onDisconnectRedirectLink = typeof window !== 'undefined'
  ? `${window.location.origin}/onDisconnect`
  : '/onDisconnect';

export default function PhantomWalletConnector() {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [dappKeyPair] = useState(nacl.box.keyPair());
  const [sharedSecret, setSharedSecret] = useState<Uint8Array>();
  const [session, setSession] = useState<string>();
  const [deepLink, setDeepLink] = useState<string>("");

  // Для веба слушаем изменения URL через popstate и initial загрузку
  useEffect(() => {
    const handleDeepLink = () => {
      setDeepLink(window.location.href);
    };

    handleDeepLink(); // initial check

    window.addEventListener('popstate', handleDeepLink);
    return () => {
      window.removeEventListener('popstate', handleDeepLink);
    };
  }, []);

  // Обработка входящих deeplinks
  useEffect(() => {
    if (!deepLink) return;

    const url = new URL(deepLink);
    const params = url.searchParams;

    // Ошибка от Phantom
    if (params.get("errorCode")) {
      const error = Object.fromEntries([...params]);
      const message = error?.errorMessage ?? JSON.stringify(error, null, 2);
      console.log("Phantom error:", message);
      toast.error(`Phantom error: ${message}`);
      return;
    }

    // Обработка ответа connect
    if (/onConnect/.test(url.pathname)) {
      const sharedSecretDapp = nacl.box.before(
        bs58.decode(params.get("phantom_encryption_public_key")!),
        dappKeyPair.secretKey
      );

      const connectData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecretDapp
      );

      setSharedSecret(sharedSecretDapp);
      setSession(connectData.session);
      setPhantomWalletPublicKey(new PublicKey(connectData.public_key));

      console.log(`Connected to ${connectData.public_key.toString()}`);
      toast.success('Phantom Wallet подключен!');
    }

    // Обработка отключения
    if (/onDisconnect/.test(url.pathname)) {
      setPhantomWalletPublicKey(null);
      setSession(undefined);
      setSharedSecret(undefined);
      console.log("disconnected");
      toast.info('Phantom Wallet отключен');
    }
  }, [deepLink, dappKeyPair.secretKey]);

  const handleConnectWallet = useCallback(async () => {
    if (phantomWalletPublicKey) {
      toast.info('Phantom Wallet уже подключен');
      return;
    }

    setIsConnecting(true);
    try {
      const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
        cluster: "mainnet-beta", // либо devnet
        app_url: typeof window !== 'undefined' ? window.location.origin : "https://cryptochat.app",
        redirect_link: onConnectRedirectLink,
      });

      const url = buildUrl("connect", params);
      window.open(url, "_blank");
    } catch (error) {
      console.error('Ошибка при открытии Phantom:', error);
      toast.error('Не удалось открыть Phantom Wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [phantomWalletPublicKey, dappKeyPair.publicKey]);

  const handleDisconnectWallet = useCallback(async () => {
    if (!session || !sharedSecret) {
      toast.error('Нет активной сессии для отключения');
      return;
    }

    try {
      const payload = { session };
      const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

      const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
        nonce: bs58.encode(nonce),
        redirect_link: onDisconnectRedirectLink,
        payload: bs58.encode(encryptedPayload),
      });

      const url = buildUrl("disconnect", params);
      window.open(url, "_blank");
    } catch (error) {
      console.error('Ошибка отключения Phantom:', error);
      toast.error('Не удалось отключить Phantom Wallet');
    }
  }, [session, sharedSecret, dappKeyPair.publicKey]);


  return {
    phantomWalletPublicKey,
    isConnected: !!phantomWalletPublicKey,
    isConnecting,
    session,
    sharedSecret,
    dappKeyPair,
    connectWallet: handleConnectWallet,
    disconnectWallet: handleDisconnectWallet,
  };
}
