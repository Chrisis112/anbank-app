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

    // Инициализация Phantom публичного ключа (если есть)
    const savedPhantomKey = localStorage.getItem('phantom_user_public_key');
    if (savedPhantomKey) {
      setPhantomPublicKey(savedPhantomKey);
    }
  }, []);

  // Генерация ключей dApp
  function generateDappKeys(): DappKeys {
    const keypair = nacl.box.keyPair();
    const publicKey = bs58.encode(keypair.publicKey);
    const privateKey = bs58.encode(keypair.secretKey);

    localStorage.setItem('phantom_dapp_public_key', publicKey);
    localStorage.setItem('phantom_dapp_private_key', privateKey);

    return { publicKey, privateKey };
  }

  // Получение ключей dApp
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

  // Очистка localStorage
  function clearPhantomStorage() {
    localStorage.removeItem('phantom_pending_action');
    localStorage.removeItem('phantom_registration_data');
    localStorage.removeItem('phantom_subscription_data');
    localStorage.removeItem('phantom_user_public_key');
    localStorage.removeItem('phantom_dapp_public_key');
    localStorage.removeItem('phantom_dapp_private_key');
  }

  // Проверка мобильного устройства
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
      const deepLink = `https://phantom.app/ul/v1/connect?app_url=${encodeURIComponent(
        url
      )}&dapp_encryption_public_key=${dappKeys.publicKey}&redirect_link=${redirectUrl}&cluster=mainnet-beta`;
      localStorage.setItem('phantom_pending_action', 'connect');

      toast.info('Подключаемся к Phantom...');
      window.location.href = deepLink;
    } catch (e) {
      toast.error('Ошибка подключения к Phantom');
    }
  }
// В хуке: processCallback()

async function processCallbackUrl() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const nonceParam = params.get("nonce");
  const dataParam = params.get("data");
  const errorCode = params.get("errorCode");
  const errorMessage = params.get("errorMessage");

  console.log(
    "Callback params:",
    { nonceParam, dataParam, errorCode, errorMessage }
  );

  if (errorCode) {
    toast.error(`Phantom error: ${errorMessage || errorCode}`);
    clearStorage();
    window.history.replaceState({}, "", window.location.pathname);
    return;
  }

  if (!nonceParam || !dataParam) {
    console.warn("Missing nonce or data in callback");
    return;
  }

  try {
    const nonce = decodeURIComponent(nonceParam);
    const data = decodeURIComponent(dataParam);
    const dappPrivKey = localStorage.getItem("phantom_dapp_private_key") || "";

    // Шаг 1: пытаемся дешифровать без phantom public key
    let decrypted = decryptPayload(data, nonce, "", dappPrivKey);
    if (!decrypted) {
      toast.error(
        "Не удалось расшифровать данные Phantom. Попробуйте переподключиться."
      );
      clearStorage();
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (!decrypted.public_key) {
      toast.error("Отсутствует публичный ключ Phantom в декод данных.");
      clearStorage();
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // Запоминаем Phantom public key
    localStorage.setItem("phantom_user_key", decrypted.public_key);
    setPhantomPublicKey(decrypted.public_key);

    // Шаг 2: повторяем дешифровку с настоящим Phantom public key
    decrypted = decryptPayload(data, nonce, decrypted.public_key, dappPrivKey);
    if (!decrypted) {
      toast.error("Ошибка вторичной расшифровки с использованием публичного ключа.");
      clearStorage();
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    console.log("Decrypted payload:", decrypted);

    const pendingAction = localStorage.getItem("phantom_pending_action");

    if (pendingAction === "connect") {
      toast.success("Подключено к Phantom Wallet!");
      localStorage.removeItem("phantom_pending_action");

      const delayedAction = localStorage.getItem("delayedAction");
      if (delayedAction) {
        localStorage.removeItem("delayedAction");
        setTimeout(() => {
          if (delayedAction === "registration" || delayedAction === "subscription") {
            handlePhantomPayment(); // Ваша функция оплаты
          }
        }, 1000);
      }
    }

    if (pendingAction === "transaction" && decrypted.signature) {
      toast.success("Подтверждение транзакции получено.");
      localStorage.removeItem("phantom_pending_action");
      // Дополнительно: логика после подтверждения платежа
    }

    // Очистка и сброс url
    clearStorage();
    window.history.replaceState({}, "", window.location.pathname);
  } catch (err) {
    console.error("Сработала ошибка в обработке Callback:", err);
    toast.error("Ошибка при обработке ответа от Phantom.");
    clearStorage();
    window.history.replaceState({}, "", window.location.pathname);
  }
}

function clearStorage() {
  localStorage.removeItem("phantom_user_key");
  localStorage.removeItem("phantom_dapp_private_key");
  localStorage.removeItem("phantom_dapp_public_key");
  localStorage.removeItem("phantom_pending_action");
  localStorage.removeItem("phantom_registration_data");
  localStorage.removeItem("phantom_subscription_data");
  localStorage.removeItem("delayedAction");
}




  async function handlePhantomPayment(): Promise<string | null> {
    if (isMobile()) {
      if (!phantomPublicKey) {
        console.log('Phantom public key missing before mobile connect');
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
        console.log('Nonce generated for encryption:', nonce);

        const payload = { transaction: base58Tx };
        console.log('Payload before encryption:', payload);

        const encryptedPayload = encryptPayload(
          payload,
          nonce,
          dappKeys.publicKey,
          phantomPublicKey,
          bs58.decode(dappKeys.privateKey)
        );
        console.log('Encrypted payload:', encryptedPayload.slice(0, 20) + '...');

        const redirectLink = encodeURIComponent(window.location.origin + window.location.pathname);

        localStorage.setItem('phantom_pending_action', 'transaction');

        const deepLink = `https://phantom.app/ul/v1/signTransaction?dapp_encryption_public_key=${dappKeys.publicKey}&nonce=${nonce}&redirect_link=${redirectLink}&payload=${encryptedPayload}`;

        toast.info('Перенаправляем в Phantom для подписи транзакции...');
        window.location.href = deepLink;

        return null;
      } catch (e) {
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
        const fromPubkey = provider.publicKey;
        if (!fromPubkey) {
          toast.error('Не удалось получить публичный ключ Phantom');
          return null;
        }

        const toPubkey = new PublicKey(RECEIVER_WALLET);
        const lamports = Math.floor(SOL_AMOUNT * LAMPORTS_PER_SOL);

        const connection = new Connection(SOLANA_NETWORK);
        const transaction = new Transaction().add(
          SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        // Запрашиваем подпись транзакции у Phantom
        const signedTransaction = await provider.signTransaction(transaction);

        // Отправляем подписанную транзакцию в сеть
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());

        await connection.confirmTransaction(signature);

        toast.success('Транзакция успешно подписана и отправлена');

        return signature;
      } catch (error) {
        toast.error('Ошибка проведения транзакции через Phantom');
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
    connectPhantomMobile,
    processCallbackUrl,
    handlePhantomPayment,
    abortRequests,
    setPhantomPublicKey,
  };
}
