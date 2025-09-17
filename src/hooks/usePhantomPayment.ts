'use client';

import { useCallback } from 'react';
import axios from 'axios';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as Linking from 'expo-linking';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { encryptPayload } from '@/utils/encryptPayload';
import { buildUrl } from '@/utils/buildUrl';

interface PaymentParams {
  phantomWalletPublicKey: PublicKey;
  session: string;
  sharedSecret: Uint8Array;
  dappKeyPair: nacl.BoxKeyPair;
  token: string; // JWT токен для авторизации на сервере
  amountOverride?: number; // опционально, сумма в SOL для платежа
}

export const usePhantomPayment = () => {
  const processPayment = useCallback(async (params: PaymentParams): Promise<string | null> => {
    const { phantomWalletPublicKey, session, sharedSecret, dappKeyPair, token, amountOverride } = params;

    try {
      // Подключение к Solana mainnet
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com'
      );

      // Получатель платежа
      const receiverWallet = new PublicKey(
        process.env.NEXT_PUBLIC_RECEIVER_WALLET || ''
      );

      // Сумма в SOL (берется из env или из параметров)
      const amount = amountOverride ?? parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.001');
      const lamports = amount * LAMPORTS_PER_SOL;

      // Создание транзакции перевода SOL
      const transaction = new Transaction();
      
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: phantomWalletPublicKey,
          toPubkey: receiverWallet,
          lamports: lamports,
        })
      );

      // Настройка транзакции
      transaction.feePayer = phantomWalletPublicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // Сериализация транзакции
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
      });

      // Создание redirect ссылки для deeplink
      const onSignAndSendTransactionRedirectLink = Linking.createURL('onSignAndSendTransaction');

      // Подготовка payload для Phantom
      const payload = {
        session,
        transaction: bs58.encode(serializedTransaction),
      };

      // Шифрование payload
      const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

      // Параметры для deeplink
      const urlParams = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
        nonce: bs58.encode(nonce),
        redirect_link: onSignAndSendTransactionRedirectLink,
        payload: bs58.encode(encryptedPayload),
      });

      // Отправка транзакции в Phantom
      const signUrl = buildUrl('signAndSendTransaction', urlParams);
      await Linking.openURL(signUrl);

      // После успешной подписи надо подтвердить платеж на сервере
      // Здесь ждем, что deeplink с подписью транзакции будет обработан в компоненте

      return 'TRANSACTION_SENT_FOR_SIGNING';

    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }, []);

  // Новый метод для подтверждения платежа на сервере
  const confirmPaymentOnServer = useCallback(async (transactionId: string, amount: number, token: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.anbanktoken.com/api';

    try {
      const response = await axios.post(
        `${apiUrl}/payments/confirm`,
        { transactionId, amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Payment confirmation server error:', error);
      throw error;
    }
  }, []);

  return { processPayment, confirmPaymentOnServer };
};
