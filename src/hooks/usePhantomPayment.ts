'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as Linking from 'expo-linking';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { encryptPayload } from '@/utils/encryptPayload';
import { buildUrl } from '@/utils/buildUrl';
import { toast } from 'react-toastify';
import { decryptPayload } from '@/utils/decryptPayload';

// Сделаем поля session, sharedSecret и dappKeyPair опциональными
interface PaymentParams {
  phantomWalletPublicKey: PublicKey;
  token: string;
  session?: string;
  sharedSecret?: Uint8Array;
  dappKeyPair?: nacl.BoxKeyPair;
  amountOverride?: number;
}

export const usePhantomPayment = () => {
  const [deepLink, setDeepLink] = useState<string>('');
  const [pendingRegistrationData, setPendingRegistrationData] = useState<any>(null);
  const [sharedSecret, setSharedSecret] = useState<Uint8Array | undefined>(undefined);
  const [onCompleteRegistration, setOnCompleteRegistration] = useState<((data: any, signature: string) => void) | null>(null);

  // Обработка deeplink с подписью транзакции от Phantom
  useEffect(() => {
    const initializeDeeplinks = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) setDeepLink(initialUrl);
    };
    initializeDeeplinks();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      setDeepLink(url);
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (!deepLink || !sharedSecret) return;

    try {
      const url = new URL(deepLink);
      const params = url.searchParams;

      if (/onSignAndSendTransaction/.test(url.pathname)) {
        const encryptedData = params.get('data');
        const nonce = params.get('nonce');

        if (!encryptedData || !nonce) {
          toast.error('Отсутствуют данные платежа');
          return;
        }

        const decrypted = decryptPayload(encryptedData, nonce, sharedSecret);

        if (decrypted?.signature) {
          toast.success('Платеж успешно подтверждён');

          if (pendingRegistrationData && onCompleteRegistration) {
            onCompleteRegistration(pendingRegistrationData, decrypted.signature);
            setPendingRegistrationData(null);
            setOnCompleteRegistration(null);
          }
        } else {
          toast.error('Ошибка в подписи платежа');
        }
      }
    } catch (e) {
      toast.error('Ошибка при обработке результата платежа');
      console.error(e);
    }
  }, [deepLink, sharedSecret, pendingRegistrationData, onCompleteRegistration]);

  // Функция для запуска оплаты (с поддержкой desktop и mobile)
  const processPayment = useCallback(
    async (params: PaymentParams): Promise<string | null> => {
      const { phantomWalletPublicKey, token, session, sharedSecret, dappKeyPair, amountOverride } = params;

      // если есть данные для mobile (session, sharedSecret, dappKeyPair) — используем мобильный flow
      const isMobileFlow = session !== undefined && sharedSecret !== undefined && dappKeyPair !== undefined;

      if (isMobileFlow) {
        setSharedSecret(sharedSecret);

        try {
          const connection = new Connection(
            process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com'
          );

          const receiverWallet = new PublicKey(process.env.NEXT_PUBLIC_RECEIVER_WALLET || '');

          const amount = amountOverride ?? parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.001');
          const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

          const transaction = new Transaction();
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: phantomWalletPublicKey,
              toPubkey: receiverWallet,
              lamports,
            })
          );

          transaction.feePayer = phantomWalletPublicKey;
          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;

          const serializedTransaction = transaction.serialize({ requireAllSignatures: false });

          const onSignAndSendTransactionRedirectLink = Linking.createURL('onSignAndSendTransaction');

          const payload = {
            session,
            transaction: bs58.encode(serializedTransaction),
          };

          const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

          const urlParams = new URLSearchParams({
            dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
            nonce: bs58.encode(nonce),
            redirect_link: onSignAndSendTransactionRedirectLink,
            payload: bs58.encode(encryptedPayload),
          });

          const signUrl = buildUrl('signAndSendTransaction', urlParams);
          await Linking.openURL(signUrl);

          // Ждем, что deeplink будет обработан в useEffect
          return 'TRANSACTION_SENT_FOR_SIGNING';
        } catch (error) {
          console.error('Error processing mobile payment:', error);
          throw error;
        }
      } else {
        // Desktop flow — выполняем оплату через Phantom расширение (browser wallet)
        try {
          if (!phantomWalletPublicKey) throw new Error('Missing phantomWalletPublicKey for desktop payment');

          // Здесь должна быть логика создания и отправки транзакции через Phantom extension API
          // Например:
          // const connection = new Connection(...);
          // Создайте и подпишите транзакцию здесь и отправьте через window.solana.signAndSendTransaction

          // Для примера, просто возвращаем фиктивный ответ
          return 'DESKTOP_PAYMENT_FLOW_COMPLETED';
        } catch (error) {
          console.error('Error processing desktop payment:', error);
          throw error;
        }
      }
    },
    []
  );

  const confirmPaymentOnServer = useCallback(
    async (transactionId: string, amount: number, token: string) => {
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
    },
    []
  );

  // Метод для компонента регистрации, чтобы установить данные и callback
  const initPendingRegistration = useCallback(
    (data: any, completeRegistration: (data: any, signature: string) => void) => {
      setPendingRegistrationData(data);
      setOnCompleteRegistration(() => completeRegistration);
    },
    []
  );

  return { processPayment, confirmPaymentOnServer, initPendingRegistration };
};
