'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import RegisterForm from './RegisterForm';
import LoginModal from './LoginModal';
import SubscriptionModal from './SubscriptionModal';

import { usePhantomPayment } from '@/hooks/usePhantomPayment';
import { checkUnique, registerUser, loginUser, renewSubscription } from '@/utils/api';
import { useUserStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import PhantomWalletConnector from '@/hooks/PhantomWalletConnector';

type Role = 'newbie' | 'advertiser' | 'creator';

export default function RegistrationForm() {
  const router = useRouter();
  const register = useAuthStore(state => state.register);
  const { setUser } = useUserStore();

  const {
    processPayment,
    isLoading: paymentLoading,
    error: paymentError,
    isConnected,
    publicKey,
  } = usePhantomPayment();

  const walletModal = useWalletModal();

  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);

  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);

  const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  // Механизм отложенного действия для мобильных устройств
  useEffect(() => {
    async function completeDelayedAction() {
      const action = localStorage.getItem('phantom_actual_action');
      
      if (action === 'registration') {
        const savedDataStr = localStorage.getItem('phantom_registration_data');
        const paymentSignature = localStorage.getItem('phantom_payment_signature');
        const solanaPublicKey = localStorage.getItem('phantom_public_key');
        
        if (savedDataStr && paymentSignature && solanaPublicKey) {
          setRegisterLoading(true);
          
          try {
            const userData = JSON.parse(savedDataStr);
            
            const result = await registerUser({
              nickname: userData.nickname,
              email: userData.email,
              password: userData.password,
              role: userData.role,
              solanaPublicKey,
              paymentSignature,
              promoCode: userData.promoCode || null,
            });

            if (result.success) {
              localStorage.setItem('token', result.token || '');
              setUser(result.user);
              toast.success('Registration successful!');
              
              // Очистка localStorage
              localStorage.removeItem('phantom_actual_action');
              localStorage.removeItem('phantom_registration_data');
              localStorage.removeItem('phantom_payment_signature');
              localStorage.removeItem('phantom_public_key');
              
              router.push('/chat');
            } else {
              toast.error(result.error || 'Registration failed');
            }
          } catch (error: any) {
            toast.error(error.message || 'Registration failed');
          } finally {
            setRegisterLoading(false);
          }
        }
      }
      
      if (action === 'subscription') {
        const savedDataStr = localStorage.getItem('phantom_subscription_data');
        const paymentSignature = localStorage.getItem('phantom_payment_signature');
        const solanaPublicKey = localStorage.getItem('phantom_public_key');
        
        if (savedDataStr && paymentSignature && solanaPublicKey) {
          try {
            const subscriptionData = JSON.parse(savedDataStr);
            
            const data = await renewSubscription(paymentSignature, solanaPublicKey, subscriptionData.email);
            toast.success('Subscription successfully renewed!');
            localStorage.setItem('token', data.token);
            setUser(data.user);
            
            // Очистка localStorage
            localStorage.removeItem('phantom_actual_action');
            localStorage.removeItem('phantom_subscription_data');
            localStorage.removeItem('phantom_payment_signature');
            localStorage.removeItem('phantom_public_key');
            
            setIsSubscriptionModalOpen(false);
            router.push('/chat');
          } catch (error: any) {
            toast.error(error.message || 'Error renewing subscription');
          }
        }
      }
    }

    completeDelayedAction();
  }, [router, setUser]);

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
      toast.error('Passwords do not match');
      setRegisterLoading(false);
      return;
    }

    const { emailExists, nicknameExists } = await checkUnique(data.email, data.nickname);
    if (emailExists) {
      toast.error('Email is already in use');
      setRegisterLoading(false);
      return;
    }
    if (nicknameExists) {
      toast.error('Nickname is already in use');
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
          toast.success('Registration successful!');
          router.push('/chat');
        } else {
          toast.error(result.error || 'Registration failed');
        }
        return;
      }

      // Мобильная логика
      if (isMobile) {
        localStorage.setItem('phantom_actual_action', 'registration');
        localStorage.setItem('phantom_registration_data', JSON.stringify(data));

        if (!publicKey) {
          localStorage.setItem('phantom_delayed_action', 'registration');
          walletModal.setVisible(true);
          setRegisterLoading(false);
          toast.info('Please connect Phantom and then retry registration');
          return;
        }

        // Сохраняем публичный ключ
        localStorage.setItem('phantom_public_key', publicKey);

        // Запускаем оплату
        const paymentResult = await processPayment();
        
        if (!paymentResult.success || !paymentResult.signature) {
          toast.error(paymentResult.error || 'Payment failed');
          setRegisterLoading(false);
          return;
        }

        // Сохраняем подпись платежа для последующего использования
        localStorage.setItem('phantom_payment_signature', paymentResult.signature);

        setRegisterLoading(false);
        toast.info('Payment is in progress in the Phantom app. After completion, return here to complete registration.');
        return;
      }

      // Десктоп логика
      if (!isConnected || !publicKey) {
        walletModal.setVisible(true);
        setRegisterLoading(false);
        return;
      }

      const paymentResult = await processPayment();
      
      if (!paymentResult.success || !paymentResult.signature) {
        toast.error(paymentResult.error || 'Payment failed');
        setRegisterLoading(false);
        return;
      }

      // Регистрация после успешной оплаты
      const result = await registerUser({
        nickname: data.nickname,
        email: data.email,
        password: data.password,
        role: data.role,
        solanaPublicKey: publicKey, // publicKey уже строка
        paymentSignature: paymentResult.signature,
        promoCode: null,
      });

      setRegisterLoading(false);

      if (result.success) {
        localStorage.setItem('token', result.token || '');
        setUser(result.user);
        toast.success('Registration successful!');
        router.push('/chat');
      } else {
        toast.error(result.error || 'Registration failed');
      }
    } catch (error: any) {
      setRegisterLoading(false);
      toast.error(error.message || 'Registration failed');
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

      toast.success('Login successful!');
      setIsLoginModalOpen(false);
      router.push('/chat');
    } catch (err: any) {
      if (err.response?.data?.reason === 'subscription_inactive') {
        setIsLoginModalOpen(false);
        setIsSubscriptionModalOpen(true);
      } else {
        setLoginError(err.response?.data?.error || 'Login error. Check your email and password.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setLoginError(null);
  };

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setLoginError(null);
    setActiveTab('login');
  };

  const handleRenewSubscription = async () => {
    try {
      if (isMobile) {
        // Мобильное устройство
        localStorage.setItem('phantom_actual_action', 'subscription');
        localStorage.setItem('phantom_subscription_data', JSON.stringify({ email: loginEmail }));

        if (!publicKey) {
          localStorage.setItem('phantom_delayed_action', 'subscription');
          walletModal.setVisible(true);
          return;
        }

        // Сохраняем публичный ключ
        localStorage.setItem('phantom_public_key', publicKey);

        const paymentResult = await processPayment();

        if (!paymentResult.success || !paymentResult.signature) {
          toast.error(paymentResult.error || 'Payment failed');
          return;
        }

        // Сохраняем подпись платежа
        localStorage.setItem('phantom_payment_signature', paymentResult.signature);

        toast.info('After signing the transaction in Phantom, return here to complete.');
        return;
      }

      // Десктоп логика
      if (!publicKey) {
        walletModal.setVisible(true);
        return;
      }

      const paymentResult = await processPayment();

      if (!paymentResult.success || !paymentResult.signature) {
        toast.error(paymentResult.error || 'Payment failed - no signature');
        return;
      }

      const data = await renewSubscription(paymentResult.signature, publicKey, loginEmail);
      toast.success('Subscription successfully renewed!');
      localStorage.setItem('token', data.token);
      setUser(data.user);
      setIsSubscriptionModalOpen(false);
      router.push('/chat');
    } catch (error: any) {
      toast.error(error.message || 'Error renewing subscription');
    }
  };

  return (
    <>
      <div className="bg-crypto-dark min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl mx-auto px-6 py-8 rounded-xl shadow-2xl bg-crypto-dark">
          <h1 className="font-orbitron text-3xl mb-1 text-crypto-accent text-center tracking-wide">
            CryptoChat
          </h1>
          <PhantomWalletConnector />
          
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
            <RegisterForm
              onSubmit={handleRegisterSubmit}
              loading={registerLoading || paymentLoading}
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
        onClose={closeLoginModal}
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
