import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useState, useCallback, useEffect } from 'react';

// Environment variables from user's config
const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';
const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || '';
const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.36');

interface PaymentStatus {
  signature: string | null;
  confirmed: boolean;
  error: string | null;
}

interface PaymentHookReturn {
  wallet: any;
  // Connection states
  isConnected: boolean;
  isConnecting: boolean;
  publicKey: PublicKey | null;

  // Payment states
  isProcessingPayment: boolean;
  paymentStatus: PaymentStatus;

  // Functions
  connectWallet: () => Promise<boolean>;
  disconnectWallet: () => Promise<void>;
  processPayment: (customAmount?: number) => Promise<boolean>;
  resetPaymentStatus: () => void;

  // Utility functions
  getBalance: () => Promise<number | null>;
  isPhantomInstalled: boolean;
}

export const usePhantomPayment = (): PaymentHookReturn => {
  const { connection } = useConnection();
  const {
    wallet,
    publicKey,
    connected,
    connecting,
    connect,
    disconnect,
    sendTransaction,
  } = useWallet();

  // Local states
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    signature: null,
    confirmed: false,
    error: null,
  });
  const [isPhantomInstalled, setIsPhantomInstalled] = useState(false);

  // Check if Phantom is installed (works on desktop and mobile)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDesktopPhantom = !!(window as any).solana?.isPhantom;
      const isMobilePhantom = !!(window as any).phantom?.solana;
      setIsPhantomInstalled(isDesktopPhantom || isMobilePhantom);
    }
    if (wallet) setIsPhantomInstalled(true);
  }, [wallet]);

  // Connect wallet function
  const connectWallet = useCallback(async (): Promise<boolean> => {
    if (!wallet) {
      setPaymentStatus((prev) => ({
        ...prev,
        error: 'No wallet selected, please choose a wallet first.',
      }));
      return false;
    }
    try {
      await connect();
      return true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setPaymentStatus((prev) => ({
        ...prev,
        error: 'Failed to connect wallet. Please try again.',
      }));
      return false;
    }
  }, [connect, wallet]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async (): Promise<void> => {
    try {
      await disconnect();
      resetPaymentStatus();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  }, [disconnect]);

  // Get wallet balance
  const getBalance = useCallback(async (): Promise<number | null> => {
    if (!publicKey || !connection) return null;
    try {
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return null;
    }
  }, [publicKey, connection]);

  // Process payment fixes WalletSendTransactionError with correct recentBlockhash & feePayer,
  // and ensures no manual signing
  const processPayment = useCallback(async (customAmount?: number): Promise<boolean> => {
  if (!connected || !publicKey || !sendTransaction) {
    setPaymentStatus({
      signature: null,
      confirmed: false,
      error: 'Wallet not connected',
    });
    return false;
  }

  if (!RECEIVER_WALLET) {
    setPaymentStatus({
      signature: null,
      confirmed: false,
      error: 'Receiver wallet not configured',
    });
    return false;
  }

  setIsProcessingPayment(true);
  setPaymentStatus({
    signature: null,
    confirmed: false,
    error: null,
  });

  try {
    const amount = customAmount || SOL_AMOUNT;
    if (amount <= 0) throw new Error('Invalid payment amount');

    const lamports = amount * LAMPORTS_PER_SOL;
    const balance = await getBalance();
    if (balance !== null && balance < amount + 0.001)
      throw new Error('Insufficient balance for transaction');

    const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: receiverPublicKey,
        lamports: Math.floor(lamports),
      }),
    );

    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
    transaction.feePayer = publicKey!;

    console.log('User publicKey:', publicKey?.toBase58());
    console.log('Transaction feePayer:', transaction.feePayer?.toBase58());

    // Проверяем мобильное устройство
    const isMobile = typeof window !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    
    let signature: string;

    if (isMobile && wallet && 'signTransaction' in wallet) {
      // Для мобильных - подписываем вручную и отправляем raw
      console.log('Using mobile wallet flow with signTransaction');
      const signedTx = await (wallet as any).signTransaction(transaction);
      const rawTx = signedTx.serialize();
      signature = await connection.sendRawTransaction(rawTx);
    } else {
      // Для десктопа - используем стандартный sendTransaction
      console.log('Using desktop wallet flow with sendTransaction');
      signature = await sendTransaction(transaction, connection);
    }

    setPaymentStatus({
      signature,
      confirmed: false,
      error: null,
    });

    // Используем новый API confirmTransaction
    await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    }, 'confirmed');

    setPaymentStatus({
      signature,
      confirmed: true,
      error: null,
    });

    console.log(`Payment successful! Signature: ${signature}`);
    return true;
  } catch (error: any) {
    console.error('Payment failed:', error);
    setPaymentStatus({
      signature: null,
      confirmed: false,
      error: error?.message || 'Payment failed',
    });
    return false;
  } finally {
    setIsProcessingPayment(false);
  }
}, [connected, publicKey, sendTransaction, connection, wallet, getBalance]);
  // Reset helper
  const resetPaymentStatus = useCallback(() => {
    setPaymentStatus({
      signature: null,
      confirmed: false,
      error: null,
    });
  }, []);

  return {
    wallet,
    isConnected: connected,
    isConnecting: connecting,
    publicKey,

    isProcessingPayment,
    paymentStatus,

    connectWallet,
    disconnectWallet,
    processPayment,
    resetPaymentStatus,

    getBalance,
    isPhantomInstalled,
  };
};

export default usePhantomPayment;
