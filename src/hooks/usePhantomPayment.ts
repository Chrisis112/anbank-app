import { useState, useCallback } from 'react';
import {
  Connection,
  PublicKey,
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

  // Создаем кастомный connection с поддержкой транзакций версии 0
const customConnection = new Connection(SOLANA_NETWORK, {
  commitment: 'confirmed',
  // @ts-ignore
  maxSupportedTransactionVersion: 0,
});

  const createOptimizedTransaction = useCallback(
    async (
      fromPubkey: PublicKey,
      toPubkey: PublicKey,
      amount: number,
      connection: Connection
    ) => {
      if (!connection) throw new Error('Connection is undefined');

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
    },
    []
  );

  const processPayment = useCallback(async (): Promise<PaymentResult> => {
    setIsLoading(true);
    setError(null);

    try {
      if (connecting || disconnecting) throw new Error('Wallet connecting or disconnecting');
      if (!connected || !publicKey) throw new Error('Wallet not connected');
      if (!RECEIVER_WALLET) throw new Error('Receiver wallet not configured');

      const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

      const transaction = await createOptimizedTransaction(publicKey, receiverPublicKey, SOL_AMOUNT, customConnection);

      if (!sendTransaction) throw new Error('sendTransaction not available');

      const signature = await sendTransaction(transaction as any, customConnection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await customConnection.confirmTransaction(signature, 'confirmed');

      return { signature, success: true };
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred');
      return { signature: null, success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [connecting, disconnecting, connected, publicKey, createOptimizedTransaction, sendTransaction]);

  return {
    processPayment,
    isLoading,
    error,
    isConnected: connected,
    publicKey: publicKey?.toString() || null,
  };
};
