'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { toast } from 'react-toastify';
import PromoCodeInput from './PromoCodeInput';
import axios from 'axios';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { generateRandomNonce, encryptPayload, decryptPayload } from '@/utils/phantomEncryption';

type Role = 'newbie' | 'advertiser' | 'creator';

export default function RegistrationForm() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const { setUser } = useUserStore();

  // Registration states
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [role, setRole] = useState<Role>('newbie');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);

  // Login modal states
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Phantom session storage
  const [phantomSession, setPhantomSession] = useState<string | null>(null);
  const [phantomPublicKey, setPhantomPublicKey] = useState<string | null>(null);

  // Abort controller for login request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  const SOLANA_NETWORK =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';
  const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || '';
  const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.01');

  useEffect(() => {
    // Проверяем URL на наличие callback параметров от Phantom
    const urlParams = new URLSearchParams(window.location.search);
    const nonce = urlParams.get('nonce');
    const data = urlParams.get('data');
    const errorCode = urlParams.get('errorCode');
    const errorMessage = urlParams.get('errorMessage');

    if (errorCode) {
      toast.error(`Phantom error: ${errorMessage || errorCode}`);
      // Очистить URL и localStorage
      localStorage.removeItem('phantom_pending_action');
      localStorage.removeItem('phantom_registration_data');
      localStorage.removeItem('phantom_subscription_data');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (nonce && data) {
      // Обработать успешный ответ от Phantom
      handlePhantomCallback(nonce, data);
      // Очистить URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Функция определения мобильного устройства
  const isMobile = () => {
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  };

  // Обработка callback от Phantom
  const handlePhantomCallback = async (nonce: string, encryptedData: string) => {
    try {
      // Расшифруйте payload, получите подпись:
      const result = decryptPayload(
        encryptedData,
        nonce,
        localStorage.getItem('phantom_dapp_public_key')!,
        localStorage.getItem('phantom_dapp_private_key')!
      );
      
      if (!result || !result.signature) {
        toast.error('Ошибка расшифровки данных Phantom');
        return;
      }

      toast.success('Транзакция успешно подписана в Phantom!');

      const paymentSignature = result.signature;
      const solanaPublicKey = result.publicKey || phantomPublicKey;
      const pendingAction = localStorage.getItem('phantom_pending_action');

      if (pendingAction === 'registration') {
        // Завершаем регистрацию
        const registrationData = JSON.parse(localStorage.getItem('phantom_registration_data') || '{}');
        
        const registerResult = await register(
          registrationData.nickname,
          registrationData.email,
          registrationData.password,
          registrationData.role,
          solanaPublicKey,
          paymentSignature,
          registrationData.promoCode
        );

        if (registerResult.success) {
          toast.success('Registration successful!');
          router.push('/chat');
        } else {
          toast.error(registerResult.error || 'Registration failed');
        }

        // Очистить сохраненные данные
        localStorage.removeItem('phantom_pending_action');
        localStorage.removeItem('phantom_registration_data');
        
      } else if (pendingAction === 'subscription') {
        // Завершаем продление подписки
        const subscriptionData = JSON.parse(localStorage.getItem('phantom_subscription_data') || '{}');
        
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/renew-subscription`,
            {
              txSignature: paymentSignature,
              solanaPublicKey,
              email: subscriptionData.email,
            }
          );
          
          toast.success('Subscription successfully renewed!');
          localStorage.setItem('token', data.token);
          setUser(data.user);
          setIsSubscriptionModalOpen(false);
          router.push('/chat');
        } catch (err) {
          toast.error(
            axios.isAxiosError(err) && err.response?.data?.error
              ? err.response.data.error
              : 'Error renewing subscription'
          );
        }

        // Очистить сохраненные данные
        localStorage.removeItem('phantom_pending_action');
        localStorage.removeItem('phantom_subscription_data');
      }
    } catch (e) {
      toast.error('Ошибка обработки ответа от Phantom');
      // Очистить сохраненные данные при ошибке
      localStorage.removeItem('phantom_pending_action');
      localStorage.removeItem('phantom_registration_data');
      localStorage.removeItem('phantom_subscription_data');
    }
  };

  // Исправленная функция handlePhantomPayment
  const handlePhantomPayment = async (): Promise<string | null> => {
    const provider = (window as any).solana;
    
    // Десктоп: расширение Phantom
    if (provider && provider.isPhantom && !isMobile()) {
      try {
        await provider.connect();
        const connection = new Connection(SOLANA_NETWORK);
        const fromPubkey = provider.publicKey;
        const toPubkey = new PublicKey(RECEIVER_WALLET);
        const lamports = Math.floor(SOL_AMOUNT * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
        );
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const signed = await provider.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        toast.success('✅ Payment successful!');
        return signature;
      } catch (err) {
        toast.error('Payment failed');
        return null;
      }
    }
    
    // Мобильные устройства: deeplink для транзакции
    if (isMobile()) {
      if (!phantomSession || !phantomPublicKey) {
        // Сначала нужно подключиться
        await connectPhantomMobile();
        return null;
      }

      try {
        // Создаем транзакцию
        const connection = new Connection(SOLANA_NETWORK);
        const fromPubkey = new PublicKey(phantomPublicKey);
        const toPubkey = new PublicKey(RECEIVER_WALLET);
        const lamports = Math.floor(SOL_AMOUNT * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
        );
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        // Сериализуем транзакцию
        const serializedTransaction = transaction.serializeMessage();
        const base58Transaction = bs58.encode(serializedTransaction);

        // Создаем deeplink для подписания транзакции
        const currentUrl = window.location.origin + window.location.pathname;
        const redirectLink = encodeURIComponent(currentUrl);
        
        // Здесь нужны ваши ключи шифрования (сохраненные при подключении)
        const dappEncryptionPublicKey = localStorage.getItem('phantom_dapp_public_key');
        if (!dappEncryptionPublicKey) {
          toast.error('Нет ключей шифрования. Переподключитесь к Phantom.');
          return null;
        }

        const nonce = generateRandomNonce();
        const payload = {
          transaction: base58Transaction,
          session: phantomSession
        };

        const dappPrivateKeyBase58 = localStorage.getItem('phantom_dapp_private_key');
        if (!dappPrivateKeyBase58) {
          toast.error('Нет приватного ключа dApp для шифрования.');
          return null;
        }
        const dappPrivateKeyUint8Array = bs58.decode(dappPrivateKeyBase58);

        const encryptedPayload = encryptPayload(payload, nonce, dappEncryptionPublicKey, phantomPublicKey, dappPrivateKeyUint8Array);
        
        const deepLink = `https://phantom.app/ul/v1/signTransaction?dapp_encryption_public_key=${dappEncryptionPublicKey}&nonce=${nonce}&redirect_link=${redirectLink}&payload=${encryptedPayload}`;
        
        toast.info("Открываем Phantom для подписания транзакции...");
        window.location.href = deepLink;
        return null; // Возвращаем null, потому что результат будет в callback
      } catch (error) {
        console.error('Error creating mobile transaction:', error);
        toast.error('Ошибка создания транзакции');
        return null;
      }
    }

    // Phantom не найден
    toast.error('Phantom Wallet не найден. Установите Phantom или откройте через мобильное приложение.');
    return null;
  };

  // Подключение к Phantom на мобильном
  const connectPhantomMobile = async () => {
    if (!isMobile()) return;

    try {
      const currentUrl = window.location.origin + window.location.pathname;
      const appUrl = encodeURIComponent(currentUrl);
      const redirectLink = encodeURIComponent(currentUrl);
      
      // Здесь нужно генерировать ключи шифрования
      const dappEncryptionPublicKey = localStorage.getItem('phantom_dapp_public_key') || 'YOUR_DAPP_PUBLIC_KEY';
      
      const deepLink = `https://phantom.app/ul/v1/connect?app_url=${appUrl}&dapp_encryption_public_key=${dappEncryptionPublicKey}&redirect_link=${redirectLink}&cluster=mainnet-beta`;
      
      toast.info("Подключаемся к Phantom...");
      window.location.href = deepLink;
    } catch (error) {
      console.error('Error connecting to Phantom mobile:', error);
      toast.error('Ошибка подключения к Phantom');
    }
  };

  // Исправленная функция handleRenewSubscription
  const handleRenewSubscription = async () => {
    const provider = (window as any).solana;

    if (provider?.isPhantom && !isMobile()) {
      // Десктоп версия
      const solanaPublicKey = provider.publicKey?.toBase58();
      if (!solanaPublicKey) {
        toast.error('Failed to get Phantom public key');
        return;
      }
      const signature = await handlePhantomPayment();
      if (!signature) return;

      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/renew-subscription`,
          {
            txSignature: signature,
            solanaPublicKey,
            email: loginEmail,
          }
        );
        toast.success('Subscription successfully renewed!');
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsSubscriptionModalOpen(false);
        router.push('/chat');
      } catch (err) {
        toast.error(
          axios.isAxiosError(err) && err.response?.data?.error
            ? err.response.data.error
            : 'Error renewing subscription'
        );
      }
    } else if (isMobile()) {
      // Мобильная версия - сохраняем данные и запускаем платеж
      localStorage.setItem('phantom_pending_action', 'subscription');
      localStorage.setItem('phantom_subscription_data', JSON.stringify({
        email: loginEmail
      }));
      
      await handlePhantomPayment();
      toast.info("После подписания транзакции в Phantom вернитесь для завершения.");
      return; // Прерываем выполнение, ждем callback
    } else {
      toast.error('Phantom Wallet not found');
      return;
    }
  };

  const handlePromoSuccess = (code: string) => {
    setPromoCode(code);
    setPromoCodeError(null);
  };

  const handlePromoFail = (message: string) => {
    setPromoCode(null);
    setPromoCodeError(message);
  };

  const checkUnique = async (email: string, nickname: string) => {
    try {
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/check-unique`,
        { params: { email, nickname } }
      );
      return data;
    } catch (error) {
      return { emailExists: true, nicknameExists: true };
    }
  };

  // Исправленная функция handleRegisterSubmit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname || !email || !password || !confirmPassword) {
      toast.error('Fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    const { emailExists, nicknameExists } = await checkUnique(email, nickname);
    if (emailExists) {
      toast.error('Email is already in use');
      setLoading(false);
      return;
    }
    if (nicknameExists) {
      toast.error('Nickname is already in use');
      setLoading(false);
      return;
    }

    try {
      // Если есть валидный промокод — регистрируем без оплаты
      if (promoCode) {
        const result = await register(nickname, email, password, role, null, null, promoCode);
        setLoading(false);
        if (result.success) {
          toast.success('Registration successful!');
          router.push('/chat');
        } else {
          toast.error(result.error || 'Registration failed');
        }
        return;
      }

      // Для мобильных устройств - сохраняем данные формы и запускаем платеж
      if (isMobile()) {
        localStorage.setItem('phantom_pending_action', 'registration');
        localStorage.setItem('phantom_registration_data', JSON.stringify({
          nickname,
          email,
          password,
          role,
          promoCode
        }));
        
        await handlePhantomPayment();
        setLoading(false);
        toast.info("Оплата выполняется в приложении Phantom. После завершения оплаты вернитесь сюда для продолжения.");
        return; // Прерываем выполнение, ждем callback
      }

      // Десктоп версия - обычный flow
      const paymentSignature = await handlePhantomPayment();
      
      if (!paymentSignature) {
        toast.error('Payment failed');
        setLoading(false);
        return;
      }

      const solanaPublicKey = (window as any).solana?.publicKey?.toBase58();
      if (!solanaPublicKey) {
        toast.error('Failed to get public key');
        setLoading(false);
        return;
      }

      const result = await register(nickname, email, password, role, solanaPublicKey, paymentSignature, null);
      setLoading(false);

      if (result.success) {
        toast.success('Registration successful!');
        router.push('/chat');
      } else {
        toast.error(result.error || 'Registration failed');
      }
    } catch {
      setLoading(false);
      toast.error('Registration failed');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      abortControllerRef.current = new AbortController();
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        { email: loginEmail, password: loginPassword },
        {
          signal: abortControllerRef.current.signal,
          timeout: 10000,
        }
      );

      localStorage.setItem('token', res.data.token);

      if (res.data.user) {
        setUser({
          id: res.data.user._id || res.data.user.id,
          nickname: res.data.user.nickname,
          email: res.data.user.email,
          avatar: res.data.user.avatar || undefined,
          role: res.data.user.role || 'newbie',
          subscriptionExpiresAt: res.data.user.subscriptionExpiresAt || undefined,
        });
      }

      toast.success('Login successful!');
      setIsLoginModalOpen(false);
      router.push('/chat');
    } catch (err: unknown) {
      if (axios.isCancel(err)) {
        // Request was cancelled
      } else if (axios.isAxiosError(err)) {
        if (err.response?.data?.reason === 'subscription_inactive') {
          setIsLoginModalOpen(false);
          setIsSubscriptionModalOpen(true);
        } else {
          setLoginError(
            err.response?.data?.error || 'Login error. Check your email and password.'
          );
        }
      } else {
        setLoginError('Login error. Check your email and password.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setLoginError(null);
    setLoginEmail('');
    setLoginPassword('');
    setActiveTab('login');
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setLoginError(null);
    abortControllerRef.current?.abort();
    setActiveTab('register');
  };

  return (
    <>
      <div className="bg-crypto-dark min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl mx-auto px-6 py-8 rounded-xl shadow-2xl bg-crypto-dark">
          <h1 className="font-orbitron text-3xl mb-1 text-crypto-accent text-center tracking-wide">
            CryptoChat
          </h1>

          {/* Tab Switcher */}
          <div className="flex mb-5 bg-gradient-to-r from-crypto-accent to-blue-500 rounded-lg p-1 transition-all">
            <button
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'register'
                  ? 'bg-[linear-gradient(90deg,#21e0ff_0%,#6481f5_100%)] text-white'
                  : 'bg-transparent text-gray-300'
              }`}
              onClick={() => setActiveTab('register')}
              type="button"
            >
              Register
            </button>
            <button
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'login'
                  ? 'bg-[linear-gradient(90deg,#191b1f_0%,#232531_100%)] text-white'
                  : 'bg-transparent text-gray-300'
              }`}
              onClick={() => {
                setActiveTab('login');
                openLoginModal();
              }}
              type="button"
            >
              Login
            </button>
          </div>

          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block mb-1 text-white font-semibold">Nickname</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
                  placeholder="Choose a nickname"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-white font-semibold">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-white font-semibold">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-white font-semibold">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-white font-semibold">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light"
                >
                  <option value="newbie">Newbie</option>
                  <option value="advertiser">Advertiser</option>
                  <option value="creator">Creator</option>
                </select>
              </div>
              
              <PromoCodeInput
                onSuccess={handlePromoSuccess}
                onFail={handlePromoFail}
              />
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-bold transition-colors text-lg bg-gradient-to-r from-crypto-accent to-blue-500 hover:from-blue-400 hover:to-crypto-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Register'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-crypto-dark rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={closeLoginModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              type="button"
              aria-label="Close login modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-2xl font-orbitron gradient-title mb-6 text-center text-crypto-accent">
              Login
            </h2>

            {loginError && (
              <div
                className="bg-red-500/20 border border-red-500 text-red-400 p-2 rounded mb-4 text-center"
                role="alert"
              >
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="loginEmail" className="block text-sm mb-1 text-white font-semibold">
                  Email
                </label>
                <input
                  type="email"
                  id="loginEmail"
                  name="loginEmail"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
                  placeholder="email@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="loginPassword" className="block text-sm mb-1 text-white font-semibold">
                  Password
                </label>
                <input
                  type="password"
                  id="loginPassword"
                  name="loginPassword"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full p-3 rounded-lg border-2 border-crypto-accent bg-crypto-input text-white font-light transition focus:outline-none focus:ring-2 focus:ring-crypto-accent placeholder-gray-400"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-lg font-bold transition-colors text-lg bg-gradient-to-r from-crypto-accent to-blue-500 hover:from-blue-400 hover:to-crypto-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? 'Loading...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {isSubscriptionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-crypto-dark rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setIsSubscriptionModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-orbitron text-center text-crypto-accent mb-4">
              Renew your subscription
            </h2>

            <p className="text-gray-300 text-center mb-6">
              Your subscription has expired. To continue using the app, please renew it.
            </p>

            <p className="text-gray-400 text-center mb-6 italic">
              Please note that the subscription will be extended for the user: <br />
              <span className="font-semibold text-white">{loginEmail}</span>
            </p>

            <button
              onClick={handleRenewSubscription}
              className="w-full py-3 rounded-lg font-bold bg-gradient-to-r from-crypto-accent to-blue-500 hover:from-blue-400 hover:to-crypto-accent"
            >
              Pay via Phantom Wallet
            </button>
          </div>
        </div>
      )}
    </>
  );
}
