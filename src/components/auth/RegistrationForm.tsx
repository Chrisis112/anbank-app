'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import RegisterForm from './RegisterForm';
import LoginModal from './LoginModal';
import SubscriptionModal from './SubscriptionModal';
import PhantomWalletConnector from '@/hooks/PhantomWalletConnector';
import { usePhantomPayment } from '@/hooks/usePhantomPayment';
import { checkUnique, registerUser, loginUser, renewSubscription } from '@/utils/api';
import { useUserStore } from '@/store/userStore';

type Role = 'newbie' | 'advertiser' | 'creator';

export default function RegistrationForm() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const { processPayment } = usePhantomPayment();

  const { phantomWalletPublicKey, isConnected, isConnecting, connectWallet, disconnectWallet } = PhantomWalletConnector();

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

    try {
      if (data.password !== data.confirmPassword) {
        toast.error('Password not match');
        return;
      }

      const { emailExists, nicknameExists } = await checkUnique(data.email, data.nickname);

      if (emailExists) {
        toast.error('Email is already registered');
        return;
      }

      if (nicknameExists) {
        toast.error('Nickname is already used');
        return;
      }

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

        if (result.success) {
          localStorage.setItem('token', result.token || '');
          setUser(result.user);
          toast.success('Successful Register!');
          router.push('/chat');
        } else {
          toast.error(result.error || 'Registration error');
        }
        return;
      }

      if (!window.solana?.isPhantom) {
        toast.info(
          <>
            For pyament connect Phantom wallet:
            <br />
            <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="underline">
              https://phantom.app/download
            </a>
          </>
        );
        return;
      }

      if (!isConnected) {
        toast.info('Connect Phantom Wallet for payment');
        await connectWallet();
        return;
      }

      if (phantomWalletPublicKey) {
        const signature = await processPayment({ phantomWalletPublicKey });

        const result = await registerUser({
          nickname: data.nickname,
          email: data.email,
          password: data.password,
          role: data.role,
          promoCode: null,
          solanaPublicKey: phantomWalletPublicKey.toBase58(),
          paymentSignature: signature,
        });

        if (result.success) {
          localStorage.setItem('token', result.token || '');
          setUser(result.user);
          toast.success('Succesful Registration!');
          router.push('/chat');
        } else {
          toast.error(result.error || 'Registration failed');
        }
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      toast.error(error?.message || 'Registration failed');
    } finally {
      setRegisterLoading(false);
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
        setLoginError(err.response?.data?.error || 'Login error');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRenewSubscription = async () => {
    try {
      if (!isConnected || !phantomWalletPublicKey) {
        toast.error('Connect Phantom Wallet');
        return;
      }

      const signature = await processPayment({ phantomWalletPublicKey });

      const solanaPublicKey = phantomWalletPublicKey.toBase58();
      const data = await renewSubscription(signature, solanaPublicKey, loginEmail);

      toast.success('Subscription error!');
      localStorage.setItem('token', data.token);
      setUser(data.user);
      setIsSubscriptionModalOpen(false);
      router.push('/chat');
    } catch (error: any) {
      toast.error(error.message || 'Ыubscription renewal error');
    }
  };

  const isPhantomInstalled = typeof window !== 'undefined' && !!window.solana?.isPhantom;

  return (
    <>
      <div className="bg-crypto-dark min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl mx-auto px-6 py-8 rounded-xl shadow-2xl bg-crypto-dark">
          <h1 className="font-orbitron text-3xl mb-1 text-crypto-accent text-center tracking-wide">CryptoChat</h1>

          {/* Статус подключения Phantom */}
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-400">Phantom: {isConnected ? 'Connected' : 'Not connected'}</p>
            {phantomWalletPublicKey && (
              <p className="text-xs text-gray-500 break-all">{phantomWalletPublicKey.toBase58().slice(0, 20)}...</p>
            )}
            {!isConnected && (
              <>
                {!isPhantomInstalled && (
                  <p className="text-red-500 mb-2">
                    Установите Phantom Wallet:{' '}
                    <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="underline">
                      https://phantom.app/download
                    </a>
                  </p>
                )}
                {isPhantomInstalled && (
                  <button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isConnecting ? 'Подключение...' : 'Подключить Phantom'}
                  </button>
                )}
              </>
            )}
            {isConnected && (
              <button
                onClick={disconnectWallet}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Tab Switcher */}
          <div className="flex mb-5 bg-gradient-to-r from-crypto-accent to-blue-500 rounded-lg p-1 transition-all">
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'register' ? 'bg-[linear-gradient(90deg,#21e0ff_0%,#6481f5_100%)] text-white' : 'bg-transparent text-gray-300'
              }`}
              onClick={() => setActiveTab('register')}
            >
              Register
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'login' ? 'bg-[linear-gradient(90deg,#191b1f_0%,#232531_100%)] text-white' : 'bg-transparent text-gray-300'
              }`}
              onClick={() => {
                setActiveTab('login');
                setIsLoginModalOpen(true);
              }}
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

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onSubmit={handleLoginSubmit} loading={loginLoading} error={loginError} />

      <SubscriptionModal isOpen={isSubscriptionModalOpen} email={loginEmail} onClose={() => setIsSubscriptionModalOpen(false)} onPay={handleRenewSubscription} />
    </>
  );
}
