'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { PublicKey, Transaction, SystemProgram, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { decryptPayload, encryptPayload, generateRandomNonce } from '@/utils/phantomEncryption';

const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';
const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || '';
const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.36');

interface DappKeys {
  publicKey: string;
  privateKey: string;
}

export function usePhantom() {
  const [phantomPublicKey, setPhantomPublicKey] = useState<string | null>(null);
  const [dappKeys, setDappKeys] = useState<DappKeys | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Инициализация dApp ключей
    let pub = localStorage.getItem('phantom_dapp_public_key');
    let priv = localStorage.getItem('phantom_dapp_private_key');

    if (!pub || !priv) {
      const keys = generateDappKeys();
      pub = keys.publicKey;
      priv = keys.privateKey;
    }
    setDappKeys({ publicKey: pub, privateKey: priv });

    // Инициализация Phantom публичного ключа
    const savedPhantomKey = localStorage.getItem('phantom_user_public_key');
    if (savedPhantomKey) {
      setPhantomPublicKey(savedPhantomKey);
    }

    // Автоматическая обработка callback при загрузке страницы
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('data') && urlParams.get('nonce')) {
      processCallbackFromUrl();
    }
  }, []);

  function generateDappKeys(): DappKeys {
    const keypair = nacl.box.keyPair();
    const publicKey = bs58.encode(keypair.publicKey);
    const privateKey = bs58.encode(keypair.secretKey);

    localStorage.setItem('phantom_dapp_public_key', publicKey);
    localStorage.setItem('phantom_dapp_private_key', privateKey);

    return { publicKey, privateKey };
  }

  function getDappKeys(): DappKeys {
    let publicKey = localStorage.getItem('phantom_dapp_public_key');
    let privateKey = localStorage.getItem('phantom_dapp_private_key');

    if (!publicKey || !privateKey) {
      const keys = generateDappKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
    }

    return { publicKey, privateKey };
  }

  function clearPhantomStorage() {
    localStorage.removeItem('phantom_pending_action');
    localStorage.removeItem('phantom_registration_data');
    localStorage.removeItem('phantom_subscription_data');
    localStorage.removeItem('phantom_user_public_key');
    localStorage.removeItem('phantom_dapp_public_key');
    localStorage.removeItem('phantom_dapp_private_key');
    localStorage.removeItem('phantom_delayed_action');
  }

  function isMobile() {
    if (typeof navigator === 'undefined') return false;
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  async function connectPhantomMobile() {
    try {
      if (!dappKeys) {
        toast.error('Ключи dApp не инициализированы');
        return;
      }

      const url = window.location.origin + window.location.pathname;
      const redirectUrl = encodeURIComponent(url);
      const deepLink = `https://phantom.app/ul/v1/connect?app_url=${encodeURIComponent(url)}&dapp_encryption_public_key=${dappKeys.publicKey}&redirect_link=${redirectUrl}&cluster=mainnet-beta`;
      
      localStorage.setItem('phantom_pending_action', 'connect');
      toast.info('Подключаемся к Phantom...');
      
      window.location.href = deepLink;
    } catch (e) {
      console.error('Connection error:', e);
      toast.error('Ошибка подключения к Phantom');
    }
  }

  async function connectPhantomDesktop() {
    try {
      const provider = (window as any).solana;
      if (!provider || !provider.isPhantom) {
        toast.error('Phantom Wallet не найден. Установите расширение Phantom.');
        return;
      }

      const response = await provider.connect();
      const publicKey = response.publicKey.toString();
      
      localStorage.setItem('phantom_user_public_key', publicKey);
      setPhantomPublicKey(publicKey);
      
      toast.success('Подключено к Phantom Wallet!');
    } catch (error) {
      console.error('Desktop connection error:', error);
      toast.error('Ошибка подключения к Phantom');
    }
  }

  async function connectPhantom() {
    if (isMobile()) {
      await connectPhantomMobile();
    } else {
      await connectPhantomDesktop();
    }
  }

  async function processCallbackFromUrl() {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const nonceParam = params.get('nonce');
    const dataParam = params.get('data');
    const errorCode = params.get('errorCode');
    const errorMessage = params.get('errorMessage');

    console.log('Processing callback:', { hasNonce: !!nonceParam, hasData: !!dataParam, errorCode });

    if (errorCode) {
      toast.error(`Phantom error: ${errorMessage || errorCode}`);
      clearPhantomStorage();
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (!nonceParam || !dataParam) {
      return;
    }

    try {
      const nonce = decodeURIComponent(nonceParam);
      const data = decodeURIComponent(dataParam);
      const dappPrivateKey = localStorage.getItem('phantom_dapp_private_key') || '';

      console.log('Attempting decryption...');
      
      // Попытка расшифровки
      const decrypted = decryptPayload(data, nonce, '', dappPrivateKey);

      if (!decrypted) {
        console.error('Decryption failed');
        toast.error('Не удалось расшифровать данные Phantom');
        clearPhantomStorage();
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      console.log('Decryption successful:', decrypted);

      // Сохраняем публичный ключ Phantom
      if (decrypted.public_key) {
        localStorage.setItem('phantom_user_public_key', decrypted.public_key);
        setPhantomPublicKey(decrypted.public_key);
      }

      const pendingAction = localStorage.getItem('phantom_pending_action');

      if (pendingAction === 'connect') {
        toast.success('Подключено к Phantom Wallet!');
        localStorage.removeItem('phantom_pending_action');

        // Проверяем отложенные действия
        const delayedAction = localStorage.getItem('phantom_delayed_action');
        if (delayedAction) {
          localStorage.removeItem('phantom_delayed_action');
          setTimeout(() => {
            if (delayedAction === 'registration' || delayedAction === 'subscription') {
              handlePhantomPayment();
            }
          }, 1000);
        }
      }

      if (pendingAction === 'transaction') {
        if (decrypted.signature) {
          toast.success('Транзакция подписана успешно!');
          // Здесь можно добавить логику завершения регистрации/подписки
        } else {
          toast.error('Транзакция не была подписана');
        }
        localStorage.removeItem('phantom_pending_action');
      }

      // Очищаем URL
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) {
      console.error('Callback processing error:', error);
      toast.error('Ошибка обработки ответа от Phantom');
      clearPhantomStorage();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  async function handlePhantomPayment(): Promise<string | null> {
    if (isMobile()) {
      // Мобильная версия
      if (!phantomPublicKey) {
        localStorage.setItem('phantom_delayed_action', 'payment');
        await connectPhantomMobile();
        return null;
      }

      if (!dappKeys) {
        toast.error('Ключи dApp не инициализированы');
        return null;
      }

      try {
        const fromPubkey = new PublicKey(phantomPublicKey);
        const toPubkey = new PublicKey(RECEIVER_WALLET);
        const lamports = Math.floor(SOL_AMOUNT * LAMPORTS_PER_SOL);

        const connection = new Connection(SOLANA_NETWORK);
        const transaction = new Transaction().add(
          SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const serializedMsg = transaction.serializeMessage();
        const base58Tx = bs58.encode(serializedMsg);

        const nonce = generateRandomNonce();
        const payload = { transaction: base58Tx };

        const encryptedPayload = encryptPayload(
          payload,
          nonce,
          dappKeys.publicKey,
          phantomPublicKey,
          bs58.decode(dappKeys.privateKey)
        );

        const redirectLink = encodeURIComponent(window.location.origin + window.location.pathname);
        localStorage.setItem('phantom_pending_action', 'transaction');

        const deepLink = `https://phantom.app/ul/v1/signTransaction?dapp_encryption_public_key=${dappKeys.publicKey}&nonce=${nonce}&redirect_link=${redirectLink}&payload=${encryptedPayload}`;

        toast.info('Перенаправляем в Phantom для подписи транзакции...');
        window.location.href = deepLink;

        return null;
      } catch (e) {
        console.error('Payment error:', e);
        toast.error('Ошибка создания транзакции');
        return null;
      }
    } else {
      // Десктопная версия
      const provider = (window as any).solana;
      if (!provider || !provider.isPhantom) {
        toast.error('Phantom Wallet не найден');
        return null;
      }

      try {
        if (!provider.publicKey) {
          await provider.connect();
        }

        const fromPubkey = provider.publicKey;
        const toPubkey = new PublicKey(RECEIVER_WALLET);
        const lamports = Math.floor(SOL_AMOUNT * LAMPORTS_PER_SOL);

        const connection = new Connection(SOLANA_NETWORK);
        const transaction = new Transaction().add(
          SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const signedTransaction = await provider.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        await connection.confirmTransaction(signature);

        toast.success('Транзакция успешно выполнена!');
        return signature;
      } catch (error) {
        console.error('Desktop payment error:', error);
        toast.error('Ошибка проведения транзакции');
        return null;
      }
    }
  }

  function abortRequests() {
    abortControllerRef.current?.abort();
  }

  return {
    phantomPublicKey,
    dappKeys,
    generateDappKeys,
    getDappKeys,
    clearPhantomStorage,
    isMobile,
    connectPhantom,
    connectPhantomMobile,
    processCallbackFromUrl,
    handlePhantomPayment,
    abortRequests,
    setPhantomPublicKey,
  };
}
