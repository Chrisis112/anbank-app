'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import bs58 from 'bs58';
import { decryptPayload } from '@/utils/phantomEncryption';

import RegisterForm from './RegisterForm';
import LoginModal from './LoginModal';
import SubscriptionModal from './SubscriptionModal';

import usePhantomPayment from '@/hooks/usePhantomPayment';

import { checkUnique, registerUser, loginUser, renewSubscription } from '@/utils/api';
import { useUserStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import nacl from 'tweetnacl';

type Role = 'newbie' | 'advertiser' | 'creator';

export default function RegistrationForm() {
  const router = useRouter();
  const register = useAuthStore(state => state.register);
  const { setUser } = useUserStore();
  const [phantomPublicKey, setPhantomPublicKey] = useState<string | null>(null);

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

  // New state for mobile wallet connection
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isMobileWalletConnected, setIsMobileWalletConnected] = useState(false);

  // Check wallet connection status on mount and phantom changes
  useEffect(() => {
    if (isMobile && phantom.phantomPublicKey) {
      setIsMobileWalletConnected(true);
    } else {
      setIsMobileWalletConnected(false);
    }
  }, [phantom.phantomPublicKey, isMobile]);

  const handlePromoSuccess = (code: string) => {
    setPromoCode(code);
    setPromoCodeError(null);
  };

  const handlePromoFail = (message: string) => {
    setPromoCode(null);
    setPromoCodeError(message);
  };

  // Mobile wallet connect function
  const handleConnectPhantomWallet = async () => {
    if (!isMobile) return;
    
    setIsConnectingWallet(true);
    
    try {
      const connected = await phantom.connectWallet();
      if (connected) {
        setIsMobileWalletConnected(true);
        toast.success('Phantom Wallet connected successfully!');
      } else {
        toast.error('Failed to connect Phantom Wallet');
      }
    } catch (error) {
      console.error('Connect wallet error:', error);
      toast.error('Error connecting to Phantom Wallet');
    } finally {
      setIsConnectingWallet(false);
    }
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

      // Mobile flow: check if wallet is connected first
      if (isMobile) {
        if (!isMobileWalletConnected || !phantom.phantomPublicKey) {
          toast.error('Please connect your Phantom Wallet first using the "Connect Phantom Wallet" button');
          setRegisterLoading(false);
          return;
        }

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

        const handleWalletConnected = (publicKey: string) => {
  setPhantomPublicKey(publicKey);
  localStorage.setItem('phantom_user_public_key', publicKey);
  setIsMobileWalletConnected(true);
};

useEffect(() => {
  if (phantom.phantomPublicKey) {
    handleWalletConnected(phantom.phantomPublicKey);
  }
}, [phantom.phantomPublicKey]);

// При монтировании компонента (в useEffect)
useEffect(() => {
  const savedKey = localStorage.getItem('phantom_user_public_key');
  if (savedKey) {
    setPhantomPublicKey(savedKey);
    setIsMobileWalletConnected(true);
  }
}, []);

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

      // Desktop flow: connect if needed
      if (!phantom.isConnected) {
        if (!phantom.phantomPublicKey) {
          walletModal.setVisible(true);
          setRegisterLoading(false);
          toast.info('Connect your Phantom wallet first');
          return;
        }
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

      // Call backend registration with payment info
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

  const clearPhantomStorage = () => {
    localStorage.removeItem('phantom_dapp_key');
    localStorage.removeItem('phantom_dapp_secret');
    localStorage.removeItem('phantom_user_public_key');
    localStorage.removeItem('phantom_dapp_private_key');
    localStorage.removeItem('phantom_dapp_public_key');
    localStorage.removeItem('phantom_dapp_nonce');
    localStorage.removeItem('phantom_dapp_payload');
    localStorage.removeItem('phantom_dapp_signature');
    localStorage.removeItem('phantom_dapp_response');
    localStorage.removeItem('phantom_dapp_error');
  };

  const generateDappKeys = () => {
    const keypair = nacl.box.keyPair();
    const publicKey = bs58.encode(keypair.publicKey);
    const privateKey = bs58.encode(keypair.secretKey);
    localStorage.setItem('phantom_dapp_public_key', publicKey);
    localStorage.setItem('phantom_dapp_private_key', privateKey);
    return { publicKey, privateKey };
  };

  const getDappKeys = () => {
    let publicKey = localStorage.getItem('phantom_dapp_public_key');
    let privateKey = localStorage.getItem('phantom_dapp_private_key');

    if (!publicKey || !privateKey) {
      return generateDappKeys();
    }

    return { publicKey, privateKey };
  };
  
  useEffect(() => {
    async function handlePhantomCallback() {
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

          const dappKeysLocal = getDappKeys();
          const phantomPubKey = localStorage.getItem('phantom_user_public_key') || '';

          const decrypted = decryptPayload(data, nonce, phantomPubKey, dappKeysLocal.privateKey);

          if (!decrypted) {
            toast.error('Ошибка расшифровки данных Phantom');
            clearPhantomStorage();
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }

          const pendingAction = localStorage.getItem('phantom_dapp_pending_action');

          if (pendingAction === 'connect') {
            if (decrypted.public_key) {
              localStorage.setItem('phantom_user_public_key', decrypted.public_key);
              setPhantomPublicKey(decrypted.public_key);
              setIsMobileWalletConnected(true);
              toast.success('Подключено к Phantom Wallet!');
              localStorage.removeItem('phantom_dapp_pending_action');

              const delayedAction = localStorage.getItem('phantom_dapp_delayed_action');
              if (delayedAction) {
                localStorage.removeItem('phantom_dapp_delayed_action');
              }
            }
            
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }

          if (['transaction', 'registration', 'subscription'].includes(pendingAction ?? '')) {
            const paymentSignature = decrypted.signature;
            const solanaPubKey = decrypted.public_key || phantomPubKey;

            if (!paymentSignature) {
              toast.error('Транзакция не была подписана');
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
                toast.error(json.error || 'Ошибка продления подписки');
              }
            }

            clearPhantomStorage();
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (e) {
          toast.error('Ошибка обработки ответа от Phantom');
          clearPhantomStorage();
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }

    handlePhantomCallback();

    return () => {
      abortControllerRef.current?.abort();
    }
  }, []);

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
            <div>
              {/* Mobile Wallet Connection Button */}
              {isMobile && (
                <div className="mb-4">
                  <button
                    onClick={handleConnectPhantomWallet}
                    disabled={isConnectingWallet || isMobileWalletConnected}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                      isMobileWalletConnected
                        ? 'bg-green-600 text-white cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    } ${isConnectingWallet ? 'opacity-50 cursor-not-allowed' : ''}`}
                    type="button"
                  >
                    {isConnectingWallet
                      ? 'Connecting...'
                      : isMobileWalletConnected
                      ? '✓ Connected'
                      : 'Connect Phantom Wallet'
                    }
                  </button>
                  
                  {isMobileWalletConnected && phantom.phantomPublicKey && (
                    <p className="text-sm text-gray-400 text-center mt-2">
                      Wallet: {phantom.phantomPublicKey.slice(0, 8)}...{phantom.phantomPublicKey.slice(-8)}
                    </p>
                  )}
                </div>
              )}

              <RegisterForm
                onSubmit={handleRegisterSubmit}
                loading={registerLoading}
                onPromoSuccess={handlePromoSuccess}
                onPromoFail={handlePromoFail}
                initialNickname=""
                initialEmail=""
                initialRole="newbie"
              />
            </div>
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
