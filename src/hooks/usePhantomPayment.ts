'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { toast } from 'react-toastify';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Connection,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import {
  generateRandomNonce,
  encryptPayload,
  decryptPayload,
} from '@/utils/phantomEncryption';
import { useWallet } from '@solana/wallet-adapter-react';

export type Role = 'newbie' | 'advertiser' | 'creator';

export default function RegistrationForm() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const { setUser } = useUserStore();

  // States
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('newbie');
  const { publicKey, connected, connect, disconnect } = useWallet();
  const [phantomPublicKey, setPhantomPublicKey] = useState<string | null>(null);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<{
    signature: string | null;
    confirmed: boolean;
    error: string | null;
  }>({
    signature: null,
    confirmed: false,
    error: null,
  });

  const [dappKeys, setDappKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const SOLANA_NETWORK =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';
  const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || '';
  const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.36');

  // Detect mobile device
  const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  // Generate dApp keypair and save to localStorage
  const generateDappKeys = () => {
    const keypair = nacl.box.keyPair();
    const publicKey = bs58.encode(keypair.publicKey);
    const privateKey = bs58.encode(keypair.secretKey);
    localStorage.setItem('phantom_dapp_public_key', publicKey);
    localStorage.setItem('phantom_dapp_private_key', privateKey);
    return { publicKey, privateKey };
  };

  // Get or create dApp keys from localStorage
  const getDappKeys = () => {
    let publicKey = localStorage.getItem('phantom_dapp_public_key');
    let privateKey = localStorage.getItem('phantom_dapp_private_key');

    if (!publicKey || !privateKey) {
      const keys = generateDappKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
    }

    return { publicKey, privateKey };
  };

  // Sync phantomPublicKey with wallet connection
  useEffect(() => {
    console.log('Wallet connection status changed:', { connected, publicKey: publicKey?.toBase58() });
    if (connected && publicKey) {
      const pkStr = publicKey.toBase58();
      setPhantomPublicKey(pkStr);
      localStorage.setItem('phantom_user_public_key', pkStr);
    } else {
      setPhantomPublicKey(null);
      localStorage.removeItem('phantom_user_public_key');
    }
  }, [connected, publicKey]);

  // Initialize dApp keys on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const localDappKeys = getDappKeys();
    setDappKeys(localDappKeys);

    const savedPhantomPk = localStorage.getItem('phantom_user_public_key');
    if (savedPhantomPk && !phantomPublicKey) {
      setPhantomPublicKey(savedPhantomPk);
    }
  }, []);

  const resetPaymentStatus = useCallback(() => {
    setPaymentStatus({ signature: null, confirmed: false, error: null });
  }, []);

  // Clear phantom-related localStorage entries
  const clearPhantomStorage = () => {
    localStorage.removeItem('phantom_dapp_public_key');
    localStorage.removeItem('phantom_dapp_private_key');
    localStorage.removeItem('phantom_user_public_key');
    localStorage.removeItem('phantom_dapp_pending_action');
    localStorage.removeItem('phantom_dapp_delayed_action');
    localStorage.removeItem('phantom_registration_data');
    localStorage.removeItem('phantom_subscription_data');
    localStorage.removeItem('phantom_dapp_actual_action');
    localStorage.removeItem('phantom_dapp_error');
    localStorage.removeItem('phantom_dapp_payload');
    localStorage.removeItem('phantom_dapp_signature');
  };

  // Handle Phantom callback from URL params once on mount
  useEffect(() => {
    async function processCallback() {
      const params = new URLSearchParams(window.location.search);
      const nonceParam = params.get('nonce');
      const dataParam = params.get('data');
      const errorCode = params.get('errorCode');
      const errorMessage = params.get('errorMessage');

      if (errorCode) {
        toast.error(`Phantom error: ${errorMessage || errorCode}`);
        clearPhantomStorage();
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (nonceParam && dataParam) {
        try {
          const nonce = decodeURIComponent(nonceParam);
          const data = decodeURIComponent(dataParam);

          // Load keys from localStorage for decryption
          const dappKeysLocal = getDappKeys();
          const phantomPubKey = localStorage.getItem('phantom_user_public_key') || '';

          console.log('Decrypting with keys:', {
            dappPrivateKeyPresent: !!dappKeysLocal.privateKey,
            phantomPubKeyPresent: !!phantomPubKey,
          });

          const decrypted = decryptPayload(data, nonce, phantomPubKey, dappKeysLocal.privateKey);

          if (!decrypted) {
            toast.error('Ошибка расшифровки данных Phantom');
            clearPhantomStorage();
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }

          const pendingAction = localStorage.getItem('phantom_dapp_pending_action');

          // Handle connection flow
          if (pendingAction === 'connect') {
            if (decrypted.public_key) {
              localStorage.setItem('phantom_user_public_key', decrypted.public_key);
              setPhantomPublicKey(decrypted.public_key);
              toast.success('Подключено к Phantom Wallet!');
              localStorage.removeItem('phantom_dapp_pending_action');
              const delayedAction = localStorage.getItem('phantom_dapp_delayed_action');
              if (delayedAction) {
                localStorage.removeItem('phantom_dapp_delayed_action');
                setTimeout(() => {
                  processPayment();
                }, 1000);
              }
            }
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }

          // Handle transaction flow
          if (['transaction', 'registration', 'subscription'].includes(pendingAction ?? '')) {
            const paymentSignature = decrypted.signature;
            const solanaPubKey = decrypted.public_key || phantomPubKey;

            if (!paymentSignature) {
              toast.error('Транзакция не подписана');
              clearPhantomStorage();
              window.history.replaceState({}, '', window.location.pathname);
              return;
            }

            toast.success('Оплата подтверждена!');

            if (pendingAction === 'registration') {
              const regData = JSON.parse(localStorage.getItem('phantom_registration_data') || '{}');
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...regData,
                  solanaPubKey,
                  paymentSignature,
                }),
              });
              const json = await res.json();
              if (res.ok) {
                localStorage.setItem('token', json.token);
                setUser(json.user);
                router.push('/chat');
              } else {
                toast.error(json.error || 'Ошибка регистрации');
              }
            } else if (pendingAction === 'subscription') {
              const subData = JSON.parse(localStorage.getItem('phantom_subscription_data') || '{}');
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/renew-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  txSignature: paymentSignature,
                  solanaPubKey,
                  email: subData.email,
                }),
              });
              const json = await res.json();
              if (res.ok) {
                localStorage.setItem('token', json.token);
                setUser(json.user);
                setIsSubscriptionModalOpen(false);
                router.push('/chat');
              } else {
                toast.error(json.error || 'Ошибка продления');
              }
            }
            clearPhantomStorage();
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (error) {
          toast.error('Ошибка обработки ответа Phantom');
          console.error(error);
          clearPhantomStorage();
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
    processCallback();

    return () => abortControllerRef.current?.abort();
  }, []);

  // Connect wallet (for desktop and mobile)
  const connectWallet = useCallback(async (): Promise<boolean> => {
    try {
      await connect();
      console.log('Phantom wallet connected:', publicKey?.toBase58());
      toast.success('Phantom Wallet connected successfully!');
      return true;
    } catch (error) {
      toast.error('Failed to connect wallet: ' + (error as Error).message);
      return false;
    }
  }, [connect, publicKey]);

  // Create Phantom Mobile deeplink for signing transaction
  const createPhantomMobileDeeplink = async (
    transaction: Transaction,
    dappKeys: { publicKey: string; privateKey: string },
    phantomPublicKey: string,
    redirectUrl: string
  ) => {
    const nonce = generateRandomNonce();
    const serializedMessage = transaction.serializeMessage();
    const base58Transaction = bs58.encode(serializedMessage);
    const payload = { transaction: base58Transaction };

    const encryptedPayload = encryptPayload(
      payload,
      nonce,
      dappKeys.publicKey,
      phantomPublicKey,
      bs58.decode(dappKeys.privateKey)
    );

    const encodedRedirectUrl = encodeURIComponent(redirectUrl);

    const deeplink =
      `https://phantom.app/ul/v1/signTransaction?` +
      `dapp_encryption_public_key=${dappKeys.publicKey}` +
      `&nonce=${nonce}` +
      `&redirect_url=${encodedRedirectUrl}` +
      `&payload=${encryptedPayload}`;

    return deeplink;
  };

  // Payment processing function (handles desktop & mobile)
  const processPayment = useCallback(
    async (amountToSend?: number) => {
      if (!phantomPublicKey || !dappKeys) {
        toast.error('Кошелек не подключен или ключи не инициализированы');
        return false;
      }

      const amount = amountToSend || SOL_AMOUNT;
      if (amount <= 0) {
        toast.error('Невалидная сумма платежа');
        return false;
      }

      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      const connection = new Connection(SOLANA_NETWORK);
      const balance = await connection.getBalance(new PublicKey(phantomPublicKey));

      if (balance < lamports + 10000) {
        // 10000 lamports fee margin
        toast.error('Недостаточно средств');
        return false;
      }

      const toPubkey = new PublicKey(RECEIVER_WALLET);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(phantomPublicKey),
          toPubkey,
          lamports,
        })
      );
      const blockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(phantomPublicKey);

      if (!isMobile()) {
        // Desktop flow w/ injected Phantom extension
        try {
          const provider = (window as any).solana;
          await provider.connect();
          const signedTx = await provider.signTransaction(transaction);
          const signature = await connection.sendRawTransaction(signedTx.serialize());
          await connection.confirmTransaction(signature);
          toast.success('Оплата прошла успешно');
          return signature;
        } catch (error) {
          toast.error('Ошибка платежа');
          console.error(error);
          return false;
        }
      } else {
        // Mobile flow - use deeplink
        try {
          const deeplink = await createPhantomMobileDeeplink(
            transaction,
            dappKeys,
            phantomPublicKey,
            window.location.href
          );

          toast.info('Перенаправляем в приложение Phantom для оплаты');
          window.location.href = deeplink;

          return false; // payment will continue after callback
        } catch (error) {
          toast.error('Ошибка создания платежа');
          console.error(error);
          return false;
        }
      }
    },
    [phantomPublicKey, dappKeys]
  );

  // Your component's JSX and functions for register, login, etc.

  // Return at least the connectWallet, processPayment and phantomPublicKey
  return {
    connectWallet,
    processPayment,
    phantomPublicKey,
    resetPaymentStatus,
    paymentStatus,
    disconnectWallet: () => disconnect(),
    isConnected: connected,
    dappKeys,
  };
}
