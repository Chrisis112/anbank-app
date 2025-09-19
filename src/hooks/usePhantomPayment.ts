'use client';

import { useCallback } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { encryptPayload } from '@/utils/encryptPayload';
import { buildUrl } from '@/utils/buildUrl';
import { toast } from 'react-toastify';

interface PaymentParams {
  phantomWalletPublicKey: PublicKey;
  token: string;
  session?: string;
  sharedSecret?: Uint8Array;
  dappKeyPair?: nacl.BoxKeyPair;
  amountOverride?: number;
}

export const usePhantomPayment = () => {
  const processPayment = useCallback(
    async (params: PaymentParams): Promise<string | null> => {
      const { phantomWalletPublicKey, token, session, sharedSecret, dappKeyPair, amountOverride } = params;

      const isMobile = typeof window !== 'undefined'
        ? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        : false;

      const isMobileFlow = Boolean(session && sharedSecret && dappKeyPair);

      try {
        const connection = new Connection(
          process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com'
        );

        const receiverWallet = new PublicKey(
          process.env.NEXT_PUBLIC_RECEIVER_WALLET || ''
        );

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

        // Desktop flow: direct sign and send transaction
        if (!isMobile && typeof window !== 'undefined' && window.solana?.isPhantom) {
          const signedTransaction = await window.solana.signAndSendTransaction(transaction);
          await connection.confirmTransaction(signedTransaction.signature);
          return signedTransaction.signature;
        }

        // Mobile flow: deeplink flow with all needed parameters
        if (isMobile && isMobileFlow) {
          const serializedTransaction = transaction.serialize({ requireAllSignatures: false });

          const payload = {
            session,
            transaction: bs58.encode(serializedTransaction),
          };

          const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret!);

          const urlParams = new URLSearchParams({
            dapp_encryption_public_key: bs58.encode(dappKeyPair!.publicKey),
            nonce: bs58.encode(nonce),
            redirect_link: `${window.location.origin}/phantom-redirect?action=signAndSendTransaction`,
            payload: bs58.encode(encryptedPayload),
          });

          const signUrl = buildUrl('signAndSendTransaction', urlParams);

          const phantomWindow = window.open(signUrl, '_blank');

          return new Promise((resolve, reject) => {
            const messageHandler = (event: MessageEvent) => {
              if (event.origin !== window.location.origin) return;

              if (event.data?.type === 'PHANTOM_PAYMENT_RESULT') {
                window.removeEventListener('message', messageHandler);
                if (phantomWindow) phantomWindow.close();

                if (event.data.success) {
                  resolve(event.data.signature);
                } else {
                  reject(new Error(event.data.error || 'Payment failed'));
                }
              }
            };

            window.addEventListener('message', messageHandler);

            setTimeout(() => {
              window.removeEventListener('message', messageHandler);
              reject(new Error('Payment timeout'));
            }, 300000);
          });
        }

        throw new Error('Неподдерживаемая платформа для платежа');
      } catch (error) {
        console.error('Payment error:', error);
        throw error;
      }
    },
    []
  );

  const handlePaymentResult = useCallback(
    (result: any, pendingData: any, completeCallback: (data: any, signature: string) => void) => {
      if (!pendingData || !completeCallback) return;

      if (result.success && result.signature) {
        toast.success('Платеж успешно обработан!');
        completeCallback(pendingData, result.signature);
      } else {
        toast.error('Ошибка при обработке платежа');
      }
    },
    []
  );

  return { processPayment, handlePaymentResult };
};
