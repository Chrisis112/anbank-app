'use client';

import { useCallback } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { toast } from 'react-toastify';


export const usePhantomPayment = () => {

  interface PaymentParams {
  phantomWalletPublicKey: PublicKey;
  session?: string;
  sharedSecret?: Uint8Array;
  dappKeyPair?: nacl.BoxKeyPair;
  token?: string;
  amountOverride?: number;
}
  const processPayment = useCallback(
    async (params: { phantomWalletPublicKey: PublicKey; amountOverride?: number }) => {
      const { phantomWalletPublicKey, amountOverride } = params;

      if (typeof window === 'undefined' || !window.solana?.isPhantom) {
        throw new Error('Phantom Wallet не доступен');
      }

      try {
        const connection = new Connection(
          process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com'
        );

        const receiverWallet = new PublicKey(process.env.NEXT_PUBLIC_RECEIVER_WALLET || '');

        const amount = amountOverride ?? parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.001');
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: phantomWalletPublicKey,
            toPubkey: receiverWallet,
            lamports,
          })
        );

        transaction.feePayer = phantomWalletPublicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        const signedTransaction = await window.solana.signAndSendTransaction(transaction);

        console.log('Транзакция отправлена:', signedTransaction.signature);

        const confirmation = await connection.confirmTransaction(signedTransaction.signature);

        if (confirmation.value.err) {
          throw new Error('Транзакция не подтверждена');
        }

        toast.success('Платеж успешно обработан!');
        return signedTransaction.signature;
      } catch (error) {
        console.error('Ошибка обработки платежа:', error);
        toast.error('Ошибка при обработке платежа');
        throw error;
      }
    },
    []
  );

  return { processPayment };
};
