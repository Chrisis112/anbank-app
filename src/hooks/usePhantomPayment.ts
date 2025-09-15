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
      console.log('Attempting to connect wallet...');
      await connect();
      console.log('Wallet connected');
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
      console.log('Attempting to disconnect wallet...');
      await disconnect();
      resetPaymentStatus();
      console.log('Wallet disconnected');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  }, [disconnect]);

  // Get wallet balance
  const getBalance = useCallback(async (): Promise<number | null> => {
    if (!publicKey || !connection) return null;
    try {
      console.log('Fetching wallet balance...');
      const balance = await connection.getBalance(publicKey);
      console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
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
      console.log('Wallet not connected or missing sendTransaction');
      setPaymentStatus({ signature: null, confirmed: false, error: 'Wallet not connected' });
      return false;
    }

    if (!RECEIVER_WALLET) {
      console.log('Receiver wallet not configured');
      setPaymentStatus({ signature: null, confirmed: false, error: 'Receiver wallet not configured' });
      return false;
    }

    setIsProcessingPayment(true);
    setPaymentStatus({ signature: null, confirmed: false, error: null });

    try {
      const amount = customAmount || SOL_AMOUNT;
      if (amount <= 0) {
        console.log('Invalid payment amount');
        throw new Error('Invalid payment amount');
      }

      const lamports = amount * LAMPORTS_PER_SOL;
      const balance = await getBalance();
      if (balance !== null && balance < amount + 0.001) {
        console.log('Insufficient balance');
        throw new Error('Insufficient balance');
      }

      const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: receiverPublicKey,
          lamports: Math.floor(lamports),
        })
      );

      console.log('Getting blockhash and last valid block height...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      console.log('Sending transaction...');
      const signature = await sendTransaction(transaction, connection, {
        preflightCommitment: 'processed',
      });

      console.log('Transaction sent, signature:', signature);
      setPaymentStatus({ signature, confirmed: false, error: null });

      console.log('Confirming transaction...');
      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      console.log('Transaction confirmed');
      setPaymentStatus({ signature, confirmed: true, error: null });

      console.log(`✅ Payment successful! Signature: ${signature}`);

      return true;
    } catch (error: any) {
      console.error('Payment failed:', error);
      setPaymentStatus({ signature: null, confirmed: false, error: error?.message || 'Payment failed' });
      return false;
    } finally {
      setIsProcessingPayment(false);
    }
  }, [connected, publicKey, sendTransaction, connection, getBalance]);

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
