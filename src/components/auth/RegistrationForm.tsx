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
import { useWallet } from '@solana/wallet-adapter-react';


type Role = 'newbie' | 'advertiser' | 'creator';


export default function RegistrationForm() {
  const router = useRouter();
  const register = useAuthStore(state => state.register);
  const { setUser } = useUserStore();


  const phantom = usePhantomPayment();
  const walletModal = useWalletModal();


  const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);


  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);


  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { connected, publicKey, connect } = useWallet();

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
      localStorage.setItem('phantom_actual_action', 'registration');
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

      if (!phantom.publicKey) {
        localStorage.setItem('phantom_delayed_action', 'registration');
        walletModal.setVisible(true);
        setRegisterLoading(false);
        toast.info('Please connect Phantom and then retry registration');
        return;
      } 
          if (!connected) {
      // Если кошелек не подключен, принудительно попытайтесь подключиться
      try {
        await connect();
      } catch {
        alert('Please connect your Phantom wallet to proceed');
        return;
      }
    }

      const signature = await phantom.processPayment();
      if (!signature) {
        toast.error('Payment failed');
        setRegisterLoading(false);
        return;
      }

      // После успешной оплаты можно продолжить регистрацию автоматически,
      // либо показать пользователю инструкцию, как продолжить.

      setRegisterLoading(false);
      toast.info('Payment is in progress in the Phantom app. After completion, return here to continue.');
      return;
    }


    // Desktop flow
    if (!phantom.isConnected) {
      if (!phantom.publicKey) {
        walletModal.setVisible(true);
        setRegisterLoading(false);
        return;
      }
      await phantom.connectWallet();
      
    }


    const signature = await phantom.processPayment();
    if (!signature) {
      toast.error('Payment failed');
      setRegisterLoading(false);
      return;
    }


    const solanaPublicKey = phantom.publicKey?.toBase58();
    if (!solanaPublicKey) {
      toast.error('Failed to get public key');
      setRegisterLoading(false);
      return;
    }


    const result = await registerUser({
      nickname: data.nickname,
      email: data.email,
      password: data.password,
      role: data.role,
      solanaPublicKey,
      paymentSignature: signature,
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
    toast.error(error?.message || 'Registration failed');
  }
};

  useEffect(() => {
    async function tryConnect() {
      if (!connected && typeof window !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
        try {
          await connect();
        } catch (e) {
          console.log('User declined wallet connection or error', e);
        }
      }
    }
    tryConnect();
  }, [connected, connect]);




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
    if (phantom.publicKey && !isMobile) {
      const solanaPublicKey = phantom.publicKey.toBase58();


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


      if (!phantom.publicKey) {
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
    if (phantom.paymentStatus.error) toast.error(phantom.paymentStatus.error);
  }, []);


  return (
    <>
      <div className="bg-crypto-dark min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl mx-auto px-6 py-8 rounded-xl shadow-2xl bg-crypto-dark">
          <h1 className="font-orbitron text-3xl mb-1 text-crypto-accent text-center tracking-wide">
            CryptoChat
          </h1>
          <PhantomWalletConnector/>
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