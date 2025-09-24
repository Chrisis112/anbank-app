'use client';

import { useCallback } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { toast } from 'react-toastify';

export const usePhantomPayment = () => {

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

        const receiverWalletString = process.env.NEXT_PUBLIC_RECEIVER_WALLET;
        if (!receiverWalletString) {
          throw new Error('Получатель платежа не задан');
        }
        const receiverWallet = new PublicKey(receiverWalletString);

        const amount = amountOverride ?? parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.001');
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

        // Проверяем баланс пользователя
        const balance = await connection.getBalance(phantomWalletPublicKey);
        if (balance < lamports) {
          throw new Error('Недостаточно средств для оплаты');
        }

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

        console.log('Fee payer:', transaction.feePayer.toBase58());
        console.log('Recent blockhash:', transaction.recentBlockhash);

        const signedTransaction = await window.solana.signAndSendTransaction(transaction);

        console.log('Транзакция отправлена, signature:', signedTransaction.signature);

        const confirmation = await connection.confirmTransaction(signedTransaction.signature);

        if (confirmation.value.err) {
          console.error('Ошибка в подтверждении транзакции:', confirmation.value.err);
          throw new Error('Транзакция не подтверждена');
        }

        toast.success('Платеж успешно обработан!');
        return signedTransaction.signature;
      } catch (error: any) {
        console.error('Ошибка обработки платежа:', error.message || error);
        toast.error(`Ошибка при обработке платежа: ${error.message || 'неизвестная ошибка'}`);
        throw error;
      }
    },
    []
  );

  return { processPayment };
};
