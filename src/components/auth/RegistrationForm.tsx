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
import { decryptPayload } from '@/utils/decryptPayload';
import * as Linking from 'expo-linking';

type Role = 'newbie' | 'advertiser' | 'creator';

export default function RegistrationForm() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const { processPayment } = usePhantomPayment();

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

  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string>('');
  const [pendingRegistrationData, setPendingRegistrationData] = useState<any>(null);

  const [shouldRegisterAfterConnect, setShouldRegisterAfterConnect] = useState(false);
  const [registerDataAfterConnect, setRegisterDataAfterConnect] = useState<any>(null);

  // Восстановление phantomWalletPublicKey из localStorage при загрузке страницы
  useEffect(() => {
    const savedKey = localStorage.getItem('phantom_public_key');
    if (savedKey) {
      try {
        setPhantomWalletPublicKey(new window.solana.PublicKey(savedKey));
      } catch {
        localStorage.removeItem('phantom_public_key');
      }
    }
  }, [setPhantomWalletPublicKey]);

  // Обработка deeplinks для платежей
  useEffect(() => {
    const initializeDeeplinks = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) setDeepLink(initialUrl);
    };
    initializeDeeplinks();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      setDeepLink(url);
    });

    return () => subscription?.remove();
  }, []);

  // Вызов регистрации после подключения кошелька
  useEffect(() => {
    if (isConnected && shouldRegisterAfterConnect && registerDataAfterConnect) {
      handleRegisterSubmit(registerDataAfterConnect);
      setShouldRegisterAfterConnect(false);
      setRegisterDataAfterConnect(null);
    }
  }, [isConnected, shouldRegisterAfterConnect, registerDataAfterConnect]);

  // Обработка результата транзакции через deeplink
  useEffect(() => {
    if (!deepLink || !sharedSecret) return;

    const url = new URL(deepLink);
    const params = url.searchParams;

    if (/onSignAndSendTransaction/.test(url.pathname)) {
      try {
        const signAndSendTransactionData = decryptPayload(
          params.get('data')!,
          params.get('nonce')!,
          sharedSecret
        );

        console.log('Transaction completed:', signAndSendTransactionData);

        if (signAndSendTransactionData.signature) {
          toast.success('Платеж успешно обработан!');

          if (pendingRegistrationData) {
            completeRegistration(pendingRegistrationData, signAndSendTransactionData.signature);
          }
        }
      } catch (error) {
        console.error('Ошибка обработки результата транзакции:', error);
        toast.error('Ошибка при обработке результата платежа');
        setRegisterLoading(false);
      }
    }
  }, [deepLink, sharedSecret, pendingRegistrationData]);

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

    if (data.password !== data.confirmPassword) {
      toast.error('Пароли не совпадают');
      setRegisterLoading(false);
      return;
    }

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

    // Проверяем наличие Phantom и его расширение в браузере (desktop)
    const isPhantomInstalled = typeof window !== 'undefined' && !!window.solana?.isPhantom;

    try {
      if (data.promoCode) {
        // Регистрация с промокодом без оплаты
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

      if (!isConnected) {
        if (!isPhantomInstalled) {
          toast.info(
            <>
              Чтобы подключить Phantom Wallet, установите расширение для браузера или приложение mobile Phantom:
              <br />
              <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="underline">
                https://phantom.app/download
              </a>
            </>
          );
          setRegisterLoading(false);
          return;
        }

        // Запускаем подключение кошелька и ожидаем успешное подключение
        setShouldRegisterAfterConnect(true);
        setRegisterDataAfterConnect(data);

        toast.info('Сначала подключите Phantom Wallet');
        await connectWallet();
        setRegisterLoading(false);
        return;
      }

      // Убеждаемся, что кошелек полностью подключен
      if (!phantomWalletPublicKey || !session || !sharedSecret) {
        toast.error('Phantom Wallet не подключен. Пожалуйста, снова нажмите "Подключить Phantom"');
        setRegisterLoading(false);
        return;
      }

      // Сохраняем данные регистрации для обработки после платежа
      setPendingRegistrationData(data);

      // Инициируем платеж через Phantom
      await processPayment({
        phantomWalletPublicKey,
        session: session!,
        sharedSecret: sharedSecret!,
        dappKeyPair: dappKeyPair!, // Уверены, что не null
        token: localStorage.getItem('token') || '',
      });

      toast.info('Ожидание подтверждения транзакции...');
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
      if (!phantomWalletPublicKey || !session || !sharedSecret) {
        throw new Error('Phantom Wallet не подключен или отсутствует sharedSecret');
      }

      const signature = await processPayment({
        phantomWalletPublicKey,
        session: session!,
        sharedSecret: sharedSecret!,
        dappKeyPair: dappKeyPair!,
        token: localStorage.getItem('token') || '',
      });

      if (!signature) {
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
            <p className="text-sm text-gray-400">Phantom: {isConnected ? 'Подключен' : 'Не подключен'}</p>
            {phantomWalletPublicKey && (
              <p className="text-xs text-gray-500 break-all">{phantomWalletPublicKey.toBase58().slice(0, 20)}...</p>
            )}
            {!isConnected && (
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
