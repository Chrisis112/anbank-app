'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import RegisterForm from './RegisterForm';
import LoginModal from './LoginModal';
import SubscriptionModal from './SubscriptionModal';
import PhantomWalletConnector from '@/hooks/PhantomWalletConnector';
import { usePhantomPayment } from '@/hooks/usePhantomPayment';
import { checkUnique, registerUser, loginUser, renewSubscription } from '@/utils/api';
import { useUserStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { PublicKey } from '@solana/web3.js';

type Role = 'newbie' | 'advertiser' | 'creator';

export default function RegistrationForm() {
  const router = useRouter();
  const { setUser } = useUserStore();

  const {
    phantomWalletPublicKey,
    isConnected,
    isConnecting,
    session,
    sharedSecret,
    dappKeyPair,
    connectWallet,
    disconnectWallet,
    setPhantomWalletPublicKey,
  } = PhantomWalletConnector();

  const { processPayment, handlePaymentResult } = usePhantomPayment();

  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
  const [pendingRegistrationData, setPendingRegistrationData] = useState<any>(null);
  const [shouldRegisterAfterConnect, setShouldRegisterAfterConnect] = useState(false);
  const [registerDataAfterConnect, setRegisterDataAfterConnect] = useState<any>(null);

  // Восстановление сохраненного публичного ключа
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedKey = localStorage.getItem('phantom_public_key');
    if (savedKey) {
      try {
        setPhantomWalletPublicKey(new PublicKey(savedKey));
      } catch {
        localStorage.removeItem('phantom_public_key');
      }
    }
  }, [setPhantomWalletPublicKey]);


  // Проверка результата мобильного платежа при возврате
useEffect(() => {
  const paymentResult = sessionStorage.getItem('phantom_payment_result');
  if (paymentResult && pendingRegistrationData) {
    try {
      const result = JSON.parse(paymentResult);
      sessionStorage.removeItem('phantom_payment_result');
      
      if (result.success && result.signature) {
        completeRegistration(pendingRegistrationData, result.signature);
      } else {
        toast.error('Ошибка платежа: ' + (result.error || 'Неизвестная ошибка'));
        setRegisterLoading(false);
        setPendingRegistrationData(null);
      }
    } catch (error) {
      console.error('Error parsing payment result:', error);
      setRegisterLoading(false);
      setPendingRegistrationData(null);
    }
  }
}, [pendingRegistrationData]);

  // Обработка deeplinks только на мобильных устройствах
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' 
      ? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      : false;

    if (!isMobile) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PHANTOM_PAYMENT_RESULT') {
        handlePaymentResult(event.data.result, pendingRegistrationData, completeRegistration);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [pendingRegistrationData, handlePaymentResult]);

  // Регистрация после подключения кошелька
  useEffect(() => {
    if (isConnected && shouldRegisterAfterConnect && registerDataAfterConnect) {
      handleRegisterSubmit(registerDataAfterConnect);
      setShouldRegisterAfterConnect(false);
      setRegisterDataAfterConnect(null);
    }
  }, [isConnected, shouldRegisterAfterConnect, registerDataAfterConnect]);

  const completeRegistration = async (data: any, signature: string) => {
    try {
      const authStore = useAuthStore.getState();
      const solanaPublicKey = phantomWalletPublicKey?.toBase58() ?? null;

      const result = await authStore.register(
        data.nickname,
        data.email,
        data.password,
        data.role,
        solanaPublicKey,
        signature,
        data.promoCode
      );

      setRegisterLoading(false);
      setPendingRegistrationData(null);

      if (result.success) {
        localStorage.setItem('token', result.token || '');
        setUser(result.user ?? null);
        toast.success('Регистрация успешна!');
        router.push('/chat');
      } else {
        toast.error(result.error || 'Ошибка регистрации');
      }
    } catch (error: any) {
      setRegisterLoading(false);
      setPendingRegistrationData(null);
      toast.error(error?.message || 'Ошибка регистрации');
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

  const handleRegisterSubmit = async (data: {
    nickname: string;
    email: string;
    password: string;
    confirmPassword: string;
    role: Role;
    promoCode: string | null;
  }) => {
    setRegisterLoading(true);

    // Проверяем совпадение паролей
    if (data.password !== data.confirmPassword) {
      toast.error('Пароли не совпадают');
      setRegisterLoading(false);
      return;
    }

    // Проверяем уникальность email и никнейма
    const { emailExists, nicknameExists } = await checkUnique(data.email, data.nickname);

    if (emailExists) {
      toast.error('Email уже используется');
      setRegisterLoading(false);
      return;
    }

    if (nicknameExists) {
      toast.error('Никнейм уже используется');
      setRegisterLoading(false);
      return;
    }

    const isPhantomInstalled = typeof window !== 'undefined' && !!window.solana?.isPhantom;
    const isMobile = typeof window !== 'undefined'
      ? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      : false;

    try {
      // Регистрация с промокодом без оплаты
      if (data.promoCode) {
        const result = await registerUser({
          nickname: data.nickname,
          email: data.email,
          password: data.password,
          role: data.role,
          promoCode: data.promoCode,
          solanaPublicKey: null,
          paymentSignature: null,
        });
        setRegisterLoading(false);

        if (result.success) {
          localStorage.setItem('token', result.token || '');
          setUser(result.user);
          toast.success('Регистрация успешна!');
          router.push('/chat');
        } else {
          toast.error(result.error || 'Ошибка регистрации');
        }
        return;
      }

      // Проверка подключения кошелька
      if (!phantomWalletPublicKey) {
        if (!isPhantomInstalled && !isMobile) {
          toast.info(
            <>
              Чтобы подключить Phantom Wallet, установите расширение для браузера:
              <br />
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                https://phantom.app/download
              </a>
            </>
          );
          setRegisterLoading(false);
          return;
        }

        setShouldRegisterAfterConnect(true);
        setRegisterDataAfterConnect(data);
        toast.info('Сначала подключите Phantom Wallet');
        await connectWallet();
        setRegisterLoading(false);
        return;
      }

      // Обработка платежа
      setPendingRegistrationData(data);
      
      const paymentParams = {
        phantomWalletPublicKey,
        token: localStorage.getItem('token') || '',
        ...(isMobile && session && sharedSecret && dappKeyPair ? {
          session,
          sharedSecret,
          dappKeyPair
        } : {})
      };

      const result = await processPayment(paymentParams);

      // Desktop: получаем подпись сразу
      if (!isMobile && result && typeof result === 'string') {
        await completeRegistration(data, result);
      } else {
        // Mobile: ждем результат через deeplink
        toast.info('Ожидание подтверждения транзакции...');
      }
      
      setRegisterLoading(false);
    } catch (error: any) {
      setRegisterLoading(false);
      setPendingRegistrationData(null);
      toast.error(error?.message || 'Ошибка регистрации');
    }
  };

  const handleLoginSubmit = async (email: string, password: string) => {
    setLoginLoading(true);
    setLoginError(null);
    setLoginEmail(email);

    try {
      const data = await loginUser(email, password);
      localStorage.setItem('token', data.token);

      if (data.user) {
        setUser({
          id: data.user._id || data.user.id,
          nickname: data.user.nickname,
          email: data.user.email,
          avatar: data.user.avatar || undefined,
          role: data.user.role || 'newbie',
          subscriptionExpiresAt: data.user.subscriptionExpiresAt || undefined,
        });
      }

      toast.success('Вход выполнен успешно!');
      setIsLoginModalOpen(false);
      router.push('/chat');
    } catch (err: any) {
      if (err.response?.data?.reason === 'subscription_inactive') {
        setIsLoginModalOpen(false);
        setIsSubscriptionModalOpen(true);
      } else {
        setLoginError(err.response?.data?.error || 'Ошибка входа');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRenewSubscription = async () => {
    try {
      if (!isConnected || !phantomWalletPublicKey) {
        toast.error('Подключите Phantom Wallet');
        return;
      }

      const isMobile = typeof window !== 'undefined'
        ? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        : false;

      const paymentParams = {
        phantomWalletPublicKey,
        token: localStorage.getItem('token') || '',
        ...(isMobile && session && sharedSecret && dappKeyPair ? {
          session,
          sharedSecret,
          dappKeyPair
        } : {})
      };

      const signature = await processPayment(paymentParams);

      if (!signature || typeof signature !== 'string') {
        toast.error('Ошибка платежа');
        return;
      }

      const solanaPublicKey = phantomWalletPublicKey.toBase58();
      const data = await renewSubscription(signature, solanaPublicKey, loginEmail);

      toast.success('Подписка успешно продлена!');
      localStorage.setItem('token', data.token);
      setUser(data.user);
      setIsSubscriptionModalOpen(false);
      router.push('/chat');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка продления подписки');
    }
  };

  const isPhantomInstalled = typeof window !== 'undefined' && !!window.solana?.isPhantom;

  return (
    <>
      <div className="bg-crypto-dark min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl mx-auto px-6 py-8 rounded-xl shadow-2xl bg-crypto-dark">
          <h1 className="font-orbitron text-3xl mb-1 text-crypto-accent text-center tracking-wide">
            CryptoChat
          </h1>

          {/* Статус подключения Phantom */}
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-400">
              Phantom: {isConnected ? 'Подключен' : 'Не подключен'}
            </p>
            {phantomWalletPublicKey && (
              <p className="text-xs text-gray-500 break-all">
                {phantomWalletPublicKey.toBase58().slice(0, 20)}...
              </p>
            )}
            {!phantomWalletPublicKey && (
              <>
                {!isPhantomInstalled && (
                  <p className="text-red-500 mb-2">
                    Пожалуйста, установите Phantom Wallet:{' '}
                    <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="underline">
                      https://phantom.app/download
                    </a>
                  </p>
                )}
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isConnecting ? 'Подключение...' : 'Подключить Phantom'}
                </button>
              </>
            )}
            {phantomWalletPublicKey && (
              <button
                onClick={disconnectWallet}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Отключить кошелек
              </button>
            )}
          </div>

          {/* Tab Switcher */}
          <div className="flex mb-5 bg-gradient-to-r from-crypto-accent to-blue-500 rounded-lg p-1 transition-all">
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'register'
                  ? 'bg-[linear-gradient(90deg,#21e0ff_0%,#6481f5_100%)] text-white'
                  : 'bg-transparent text-gray-300'
              }`}
              onClick={() => setActiveTab('register')}
            >
              Регистрация
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'login'
                  ? 'bg-[linear-gradient(90deg,#191b1f_0%,#232531_100%)] text-white'
                  : 'bg-transparent text-gray-300'
              }`}
              onClick={() => {
                setActiveTab('login');
                setIsLoginModalOpen(true);
              }}
            >
              Вход
            </button>
          </div>

          {activeTab === 'register' && (
            <RegisterForm
              onSubmit={handleRegisterSubmit}
              loading={registerLoading}
              onPromoSuccess={handlePromoSuccess}
              onPromoFail={handlePromoFail}
              initialNickname=""
              initialEmail=""
              initialRole="newbie"
            />
          )}
        </div>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSubmit={handleLoginSubmit}
        loading={loginLoading}
        error={loginError}
      />

      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        email={loginEmail}
        onClose={() => setIsSubscriptionModalOpen(false)}
        onPay={handleRenewSubscription}
      />
    </>
  );
}
