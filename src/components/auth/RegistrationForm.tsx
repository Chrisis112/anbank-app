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
import * as Linking from 'expo-linking';
import { decryptPayload } from '@/utils/decryptPayload';

type Role = 'newbie' | 'advertiser' | 'creator';

const onSignAndSendTransactionRedirectLink = Linking.createURL("onSignAndSendTransaction");

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
  const [deepLink, setDeepLink] = useState<string>("");

  // Обработка deeplinks для платежей
  useEffect(() => {
    const initializeDeeplinks = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        setDeepLink(initialUrl);
      }
    };

    initializeDeeplinks();
    const listener = Linking.addEventListener("url", handleDeepLink);

    return () => {
      listener.remove();
    };
  }, []);

  const handleDeepLink = ({ url }: { url: string }) => {
    setDeepLink(url);
  };

  // Обработка результата транзакции
  useEffect(() => {
    if (!deepLink || !sharedSecret) return;

    const url = new URL(deepLink);
    const params = url.searchParams;

    if (/onSignAndSendTransaction/.test(url.pathname)) {
      try {
        const signAndSendTransactionData = decryptPayload(
          params.get("data")!,
          params.get("nonce")!,
          sharedSecret
        );

        console.log("Transaction completed:", signAndSendTransactionData);
        
        if (signAndSendTransactionData.signature) {
          toast.success(`Платеж успешно обработан! Подпись: ${signAndSendTransactionData.signature}`);
          
          // Здесь можно добавить логику для завершения регистрации
          // после успешного платежа
        }
      } catch (error) {
        console.error("Ошибка обработки результата транзакции:", error);
        toast.error("Ошибка при обработке результата платежа");
      }
    }
  }, [deepLink, sharedSecret]);

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

      // Регистрация с оплатой через Phantom
      if (!isConnected) {
        toast.info('Сначала подключите Phantom Wallet');
        await connectWallet();
        setRegisterLoading(false);
        return;
      }

      if (!phantomWalletPublicKey || !session || !sharedSecret) {
        toast.error('Phantom Wallet не подключен');
        setRegisterLoading(false);
        return;
      }

      const signature = await processPayment({
        phantomWalletPublicKey,
        session,
        sharedSecret,
        dappKeyPair,
      });

      if (!signature || signature === 'TRANSACTION_SENT_FOR_SIGNING') {
        // Транзакция отправлена на подпись, ждем результата через deeplink
        toast.info('Ожидание подтверждения транзакции...');
        setRegisterLoading(false);
        return;
      }

      // Если получили подпись сразу (не через deeplink)
      const solanaPublicKey = phantomWalletPublicKey.toBase58();
      const authStore = useAuthStore.getState();

      const result = await authStore.register(
        data.nickname,
        data.email,
        data.password,
        data.role,
        solanaPublicKey,
        signature,
        promoCode
      );

      setRegisterLoading(false);

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
      toast.error(error?.message || 'Ошибка регистрации');
    }
  };

  // Остальные методы остаются без изменений...
  const handleLoginSubmit = async (email: string, password: string) => {
    // ... существующая логика логина
  };

  const handleRenewSubscription = async () => {
    // ... существующая логика продления подписки
  };

  return (
    <>
      <div className="bg-crypto-dark min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl mx-auto px-6 py-8 rounded-xl shadow-2xl bg-crypto-dark">
          <h1 className="font-orbitron text-3xl mb-1 text-crypto-accent text-center tracking-wide">
            CryptoChat
          </h1>
          
          {/* Показываем статус подключения Phantom */}
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-400">
              Phantom: {isConnected ? 'Подключен' : 'Не подключен'}
            </p>
            {phantomWalletPublicKey && (
              <p className="text-xs text-gray-500 break-all">
                {phantomWalletPublicKey.toBase58()}
              </p>
            )}
          </div>

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
                setIsLoginModalOpen(true);
              }}
              type="button"
            >
              Login
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

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSubmit={handleLoginSubmit}
        loading={loginLoading}
        error={loginError}
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        email={loginEmail}
        onClose={() => setIsSubscriptionModalOpen(false)}
        onPay={handleRenewSubscription}
      />
    </>
  );
}
