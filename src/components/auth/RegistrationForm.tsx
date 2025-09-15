'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

import RegisterForm from './RegisterForm';
import LoginModal from './LoginModal';
import SubscriptionModal from './SubscriptionModal';

import usePhantomPayment from '@/hooks/usePhantomPayment';

import { checkUnique, registerUser, loginUser, renewSubscription } from '@/utils/api';
import { useUserStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

type Role = 'newbie' | 'advertiser' | 'creator';

export default function RegistrationForm() {
  const router = useRouter();
  const register = useAuthStore(state => state.register);
  const { setUser } = useUserStore();

  const phantom = usePhantomPayment();
  const walletModal = useWalletModal();

  const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
const abortControllerRef = useRef<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');

  const [registerLoading, setRegisterLoading] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoCodeError, setPromoCodeError] = useState<string | null>(null);

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
      // Register with promo code (no payment)
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
          toast.success('Registration successful!');
          router.push('/chat');
        } else {
          toast.error(result.error || 'Registration failed');
        }
        return;
      }

      // Mobile flow
      if (isMobile) {
        localStorage.setItem('phantom_pending_action', 'registration');
        localStorage.setItem(
          'phantom_registration_data',
          JSON.stringify({
            nickname: data.nickname,
            email: data.email,
            password: data.password,
            role: data.role,
            promoCode: data.promoCode,
          }),
        );

        if (!phantom.phantomPublicKey) {
          walletModal.setVisible(true);
          setRegisterLoading(false);
          toast.info('Please connect Phantom Wallet and retry registration.');
          return;
        }

        const paymentSuccess = await phantom.processPayment();
        if (!paymentSuccess) {
          toast.error('Payment failed');
          setRegisterLoading(false);
          return;
        }
        setRegisterLoading(false);
        toast.info('Payment in progress in Phantom app, please return here to continue.');
        return;
      }

      // Desktop flow
if (!phantom.isConnected) {
  if (!phantom.phantomPublicKey) {
    walletModal.setVisible(true);
    setRegisterLoading(false);
    toast.info('Connect your Phantom wallet first');
    return;
  }
  // Попытка подключиться к Phantom расширению
  const connected = await phantom.connectWallet();
  if (!connected) {
    setRegisterLoading(false);
    toast.error('Failed to connect Phantom wallet');
    return;
  }
}

const resultPayment = await phantom.processPayment();
if (!resultPayment) {
  toast.error('Payment failed');
  setRegisterLoading(false);
  return;
}

// Получаем signature после успешной оплаты
const paymentSignature = phantom.paymentStatus.signature;
if (!paymentSignature) {
  toast.error('Payment signature unavailable');
  setRegisterLoading(false);
  return;
}

const solanaPublicKey = phantom.phantomPublicKey;
if (!solanaPublicKey) {
  toast.error('Failed to get public key from wallet');
  setRegisterLoading(false);
  return;
}

// Потом вызываете вашу регистрацию
const result = await registerUser({
  nickname: data.nickname,
  email: data.email,
  password: data.password,
  role: data.role,
  solanaPublicKey,
  paymentSignature,
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
    } catch (error) {
      console.error('Registration error:', error);
      setRegisterLoading(false);
      toast.error('Registration failed');
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

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setLoginError(null);
    setActiveTab('login');
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setLoginError(null);
    abortControllerRef.current?.abort();
    setActiveTab('register');
  };

  const handleRenewSubscription = async () => {
    if (phantom.phantomPublicKey && !isMobile) {
      const solanaPublicKey = phantom.phantomPublicKey;
      const signature = phantom.paymentStatus.signature;
      if (!signature) {
        toast.error('Payment failed - no signature');
        return;
      }

      try {
        const data = await renewSubscription(signature, solanaPublicKey, loginEmail);
        toast.success('Subscription successfully renewed!');
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsSubscriptionModalOpen(false);
        router.push('/chat');
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Error renewing subscription');
      }
    } else if (isMobile) {
      localStorage.setItem('phantom_actual_action', 'subscription');
      localStorage.setItem('phantom_subscription_data', JSON.stringify({ email: loginEmail }));

      if (!phantom.phantomPublicKey) {
        localStorage.setItem('phantom_delayed_action', 'subscription');
        walletModal.setVisible(true);
        return;
      } else {
        await phantom.processPayment();
      }

      toast.info('After signing the transaction in Phantom, return here to complete.');
      return;
    } else {
      toast.error('Phantom Wallet not found');
      return;
    }
  };

useEffect(() => {
  phantom.resetPaymentStatus();
  if (phantom.paymentStatus.error) {
    toast.error(phantom.paymentStatus.error);
  }
}, []);

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
