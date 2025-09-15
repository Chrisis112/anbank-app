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
    publicKey, 
    connected, 
    connecting, 
    connect, 
    disconnect, 
    sendTransaction,
    wallet
  } = useWallet();

  // Local states
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    signature: null,
    confirmed: false,
    error: null
  });
  const [isPhantomInstalled, setIsPhantomInstalled] = useState(false);

  // Check if Phantom is installed (works on desktop and mobile)
  useEffect(() => {
    const checkPhantomInstalled = () => {
      // Check for browser extension (desktop)
      if (typeof window !== 'undefined') {
        const isDesktopPhantom = !!(window as any).solana?.isPhantom;
        // Mobile app detection - Phantom mobile injects differently
        const isMobilePhantom = !!(window as any).phantom?.solana;
        setIsPhantomInstalled(isDesktopPhantom || isMobilePhantom);
      }
    };

    checkPhantomInstalled();

    // Re-check when wallet adapter updates
    if (wallet) {
      setIsPhantomInstalled(true);
    }
  }, [wallet]);

  // Connect wallet function with cross-platform support
const connectWallet = useCallback(async (): Promise<boolean> => {
  if (!wallet) {
    setPaymentStatus(prev => ({
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
    setPaymentStatus(prev => ({
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

  // Process payment with comprehensive error handling
  const processPayment = useCallback(async (customAmount?: number): Promise<boolean> => {
    if (!connected || !publicKey || !sendTransaction) {
      setPaymentStatus({
        signature: null,
        confirmed: false,
        error: 'Wallet not connected'
      });
      return false;
    }

    if (!RECEIVER_WALLET) {
      setPaymentStatus({
        signature: null,
        confirmed: false,
        error: 'Receiver wallet not configured'
      });
      return false;
    }

    setIsProcessingPayment(true);
    setPaymentStatus({
      signature: null,
      confirmed: false,
      error: null
    });

    try {
      const amount = customAmount || SOL_AMOUNT;
      const lamports = amount * LAMPORTS_PER_SOL;

      // Validate amount
      if (amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Check if user has sufficient balance
      const balance = await getBalance();
      if (balance !== null && balance < amount + 0.001) { // +0.001 for transaction fees
        throw new Error('Insufficient balance for transaction');
      }

      // Create receiver public key
      let receiverPublicKey: PublicKey;
      try {
        receiverPublicKey = new PublicKey(RECEIVER_WALLET);
      } catch {
        throw new Error('Invalid receiver wallet address');
      }

      // Create transaction
      const transaction = new Transaction();

      // Add transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: receiverPublicKey,
        lamports: Math.floor(lamports), // Ensure integer lamports
      });

      transaction.add(transferInstruction);

      // Send transaction
      console.log(`Sending ${amount} SOL to ${RECEIVER_WALLET}...`);
      const signature = await sendTransaction(transaction, connection);

      setPaymentStatus({
        signature,
        confirmed: false,
        error: null
      });

      // Confirm transaction
      console.log('Transaction sent, waiting for confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');

      setPaymentStatus({
        signature,
        confirmed: true,
        error: null
      });

      console.log(`Payment successful! Signature: ${signature}`);
      return true;

    } catch (error: any) {
      const errorMessage = error?.message || 'Payment failed';
      console.error('Payment failed:', error);

      setPaymentStatus({
        signature: null,
        confirmed: false,
        error: errorMessage
      });

      return false;
    } finally {
      setIsProcessingPayment(false);
    }
  }, [connected, publicKey, sendTransaction, connection, getBalance]);

  // Reset payment status
  const resetPaymentStatus = useCallback(() => {
    setPaymentStatus({
      signature: null,
      confirmed: false,
      error: null
    });
  }, []);

  return {
   wallet, 
    isConnected: connected,
    isConnecting: connecting,
    publicKey,

    // Payment states
    isProcessingPayment,
    paymentStatus,

    // Functions
    connectWallet,
    disconnectWallet,
    processPayment,
    resetPaymentStatus,

    // Utility functions
    getBalance,
    isPhantomInstalled,
  };
};

export default usePhantomPayment;