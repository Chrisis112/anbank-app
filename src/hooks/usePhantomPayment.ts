import { useState, useCallback, useEffect } from 'react';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';
const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || '';
const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.36');

interface PaymentResult {
  signature: string | null;
  success: boolean;
  error?: string;
}

export const usePhantomPayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { publicKey, sendTransaction, connected, connecting, disconnecting } = useWallet();
  const { connection } = useConnection();

  const createOptimizedTransaction = useCallback(async (
    fromPubkey: PublicKey,
    toPubkey: PublicKey,
    amount: number,
    connection: Connection
  ) => {
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    const instructions = [
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      }),
    ];

    const messageV0 = new TransactionMessage({
      payerKey: fromPubkey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    return new VersionedTransaction(messageV0);
  }, []);

  const processPayment = useCallback(async (): Promise<PaymentResult> => {
    setIsLoading(true);
    setError(null);

    try {
      if (connecting || disconnecting) throw new Error('Wallet connecting or disconnecting');
      if (!connected || !publicKey) throw new Error('Wallet not connected');
      if (!RECEIVER_WALLET) throw new Error('Receiver wallet not configured');

      const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

      const transaction = await createOptimizedTransaction(publicKey, receiverPublicKey, SOL_AMOUNT, connection);

      if (!sendTransaction) throw new Error('sendTransaction not available');

      const signature = await sendTransaction(transaction as any, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      return { signature, success: true };
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred');
      return { signature: null, success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [connecting, disconnecting, connected, publicKey, createOptimizedTransaction, sendTransaction, connection]);

  return {
    processPayment,
    isLoading,
    error,
    isConnected: connected,
    publicKey: publicKey?.toString() || null,
  };
};
