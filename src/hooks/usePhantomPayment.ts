'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { PublicKey, Transaction, SystemProgram, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { decryptPayload, encryptPayload, generateRandomNonce } from '@/utils/encryptPayload';

const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';
const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || '';
const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.01');

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

    // Инициализация dApp ключей, создаем если отсутствуют
    let pub = localStorage.getItem('phantom_dapp_public_key');
    let priv = localStorage.getItem('phantom_dapp_private_key');
    if (!pub || !priv) {
      const keys = generateDappKeys();
      pub = keys.publicKey;
      priv = keys.privateKey;
    }
    setDappKeys({ publicKey: pub, privateKey: priv });

    // Восстанавливаем публичный ключ Phantom, если он есть
    const savedPhantomKey = localStorage.getItem('phantom_public_key');
    if (savedPhantomKey) {
      setPhantomPublicKey(savedPhantomKey);
    }

    // Обработка callback при загрузке страницы (если есть параметры)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('data') && urlParams.get('nonce')) {
      processCallback();
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

  function clearStorage() {
    localStorage.removeItem('phantom_dapp_public_key');
    localStorage.removeItem('phantom_dapp_private_key');
    localStorage.removeItem('phantom_public_key');
    localStorage.removeItem('phantom_pending_action');
    localStorage.removeItem('phantom_registration_data');
    localStorage.removeItem('phantom_subscription_data');
    localStorage.removeItem('delayed_action');
  }

  function isMobile() {
    if (typeof navigator === 'undefined') return false;
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  async function connectPhantomMobile() {
    if (!dappKeys) {
      toast.error('Ключи dApp не инициализированы');
      return;
    }
    const url = window.location.origin + window.location.pathname;
    const redirectUrl = encodeURIComponent(url);
    const deepLink = `https://phantom.app/ul/v1/connect?app_url=${encodeURIComponent(url)}&dapp_encryption_public_key=${dappKeys.publicKey}&redirect_link=${redirectUrl}&cluster=mainnet-beta`;

    localStorage.setItem('phantom_pending_action', 'connect');
    toast.info('Перенаправление в приложение Phantom...');
    window.location.href = deepLink;
  }

  async function connectPhantomDesktop() {
    const provider = (window as any).solana;
    if (!provider || !provider.isPhantom) {
      toast.error('Расширение Phantom Wallet не найдено в браузере');
      return;
    }
    try {
      await provider.connect();
      const pubkey = provider.publicKey?.toString() ?? null;
      if (!pubkey) throw new Error('Не удалось получить публичный ключ');
      localStorage.setItem('phantom_public_key', pubkey);
      setPhantomPublicKey(pubkey);
      toast.success('Подключено к Phantom');
    } catch (err) {
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

  async function processCallback() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');
    const nonce = params.get('nonce');
    const errorCode = params.get('errorCode');
    const errorMessage = params.get('errorMessage');

    if (errorCode) {
      toast.error(`Ошибка Phantom: ${errorMessage || errorCode}`);
      clearStorage();
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    if (!data || !nonce) return;

    try {
      const decrypted = decryptPayload(
        decodeURIComponent(data),
        decodeURIComponent(nonce),
        localStorage.getItem('phantom_public_key') || '',
        localStorage.getItem('phantom_dapp_private_key') || ''
      );
      if (!decrypted) throw new Error('Не удалось расшифровать данные');

      if (decrypted.public_key) {
        localStorage.setItem('phantom_public_key', decrypted.public_key);
        setPhantomPublicKey(decrypted.public_key);
      }
      const pendingAction = localStorage.getItem('phantom_pending_action');

      if (pendingAction === 'connect') {
        toast.success('Кошелек Phantom подключен');
        localStorage.removeItem('phantom_pending_action');
      } else if (pendingAction === 'transaction') {
        toast.success('Транзакция успешно проведена');
        localStorage.removeItem('phantom_pending_action');
      }
      clearStorage();
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) {
      toast.error('Ошибка обработки ответа Phantom');
      clearStorage();
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  

  async function handlePayment(): Promise<string | null> {
    if (!phantomPublicKey || !dappKeys) {
      toast.error('Платеж невозможен: отсутствуют необходимые ключи или кошелек не подключен');
      if (isMobile()) await connectPhantomMobile();
      else await connectPhantomDesktop();
      return null;
    }

    const connection = new Connection(SOLANA_NETWORK, 'confirmed');
    const toPubkey = new PublicKey(RECEIVER_WALLET);
    const fromPubkey = new PublicKey(phantomPublicKey);
    const lamports = Math.floor(SOL_AMOUNT * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    if (isMobile()) {
      const serializedMessage = transaction.serializeMessage();
      const base58Msg = bs58.encode(serializedMessage);
      const nonce = generateRandomNonce();
const nonceUint8 = nacl.randomBytes(24);
const nonceBase58 = bs58.encode(nonceUint8);

const encryptedPayload = encryptPayload(
  { transaction: base58Msg },
  nonceUint8, // Передаём Uint8Array, а не строку
  dappKeys.publicKey,
  phantomPublicKey,
  bs58.decode(dappKeys.privateKey)
);

      localStorage.setItem('phantom_pending_action', 'transaction');

      const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
      const deepLink = `https://phantom.app/ul/v1/signTransaction?dapp_encryption_public_key=${dappKeys.publicKey}&nonce=${nonce}&redirect_link=${redirectUrl}&payload=${encryptedPayload}`;

      toast.info('Переадресация в Phantom для подписи платежа');
      window.location.href = deepLink;
      return null;
    } else {
      try {
        const provider = (window as any).solana;
        if (!provider.isPhantom) throw new Error('Phantom Wallet не найден');
        const signedTx = await provider.signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid);
        toast.success('Оплата прошла успешно!');
        return txid;
      } catch (error) {
        toast.error('Ошибка при оплате');
        return null;
      }
    }
  }

  function abortRequests() {
    abortControllerRef.current?.abort();
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

  return {
    phantomPublicKey,
    dappKeys,
    generateDappKeys,
    getDappKeys,
    clearStorage,
    isMobile,
    connectPhantom,
    connectPhantomMobile,
    connectPhantomDesktop,
    processCallback,
    handlePayment,
    abortRequests,
    setPhantomPublicKey,
  };
}
