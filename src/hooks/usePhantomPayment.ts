import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { useState, useCallback, useEffect } from 'react';

// Environment config
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
  isConnected: boolean;
  isConnecting: boolean;
  publicKey: PublicKey | null;

  isProcessingPayment: boolean;
  paymentStatus: PaymentStatus;

  connectWallet: () => Promise<boolean>;
  disconnectWallet: () => Promise<void>;
  processPayment: (customAmount?: number) => Promise<string | null>;
  resetPaymentStatus: () => void;

  getBalance: () => Promise<number | null>;
  isPhantomInstalled: boolean;
}

// Helper: direct Phantom wallet payment for mobile (bypassing wallet adapter)
async function processPaymentDirectly(
  transaction: Transaction,
  connection: Connection,
  publicKey: PublicKey
): Promise<string> {
  //@ts-ignore
  const provider = (window as any).solana;
  if (!provider?.isPhantom) throw new Error('Phantom wallet not available');

  if (!provider.isConnected) {
    await provider.connect();
  }

  const latestBlockhash = await connection.getLatestBlockhash();

  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
  transaction.feePayer = publicKey;

  const signedTx = await provider.signTransaction(transaction);
  const serializedTx = signedTx.serialize();

  const signature = await connection.sendRawTransaction(serializedTx);

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed'
  );

  return signature;
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

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    signature: null,
    confirmed: false,
    error: null,
  });
  const [isPhantomInstalled, setIsPhantomInstalled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDesktopPhantom = !!(window as any).solana?.isPhantom;
      const isMobilePhantom = !!(window as any).phantom?.solana;
      setIsPhantomInstalled(isDesktopPhantom || isMobilePhantom);
    }
    if (wallet) setIsPhantomInstalled(true);
  }, [wallet]);

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

  const disconnectWallet = useCallback(async (): Promise<void> => {
    try {
      await disconnect();
      resetPaymentStatus();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  }, [disconnect]);

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

  const processPayment = useCallback(
    async (customAmount?: number): Promise<string | null> => {
      if (!connected || !publicKey) {
        setPaymentStatus({ signature: null, confirmed: false, error: 'Wallet not connected' });
        return null;
      }

      if (!RECEIVER_WALLET) {
        setPaymentStatus({ signature: null, confirmed: false, error: 'Receiver wallet not configured' });
        return null;
      }

      setIsProcessingPayment(true);
      setPaymentStatus({ signature: null, confirmed: false, error: null });

      try {
        const amount = customAmount || SOL_AMOUNT;
        if (amount <= 0) throw new Error('Invalid payment amount');

        const lamports = amount * LAMPORTS_PER_SOL;
        const balance = await getBalance();
        if (balance !== null && balance < amount + 0.001) throw new Error('Insufficient balance');

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
        transaction.feePayer = publicKey;

        console.log('User publicKey:', publicKey?.toBase58());
        console.log('Transaction feePayer:', transaction.feePayer?.toBase58());

        const isMobile = typeof window !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

        let signature: string;

        if (isMobile && wallet && 'signTransaction' in wallet) {
          console.log('Using direct Phantom connection for mobile wallet');
          signature = await processPaymentDirectly(transaction, connection, publicKey);
        } else {
          console.log('Using wallet adapter sendTransaction for desktop');
          signature = await sendTransaction(transaction, connection);
        }

        setPaymentStatus({ signature, confirmed: false, error: null });

        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          'confirmed',
        );

        setPaymentStatus({ signature, confirmed: true, error: null });

        console.log(`Payment successful! Signature: ${signature}`);
        return signature;
      } catch (error: any) {
        console.error('Payment failed:', error);
        setPaymentStatus({ signature: null, confirmed: false, error: error?.message || 'Payment failed' });
        return null;
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [connected, publicKey, sendTransaction, connection, wallet, getBalance],
  );

  const resetPaymentStatus = useCallback(() => {
    setPaymentStatus({ signature: null, confirmed: false, error: null });
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
