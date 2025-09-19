'use client';

import { useCallback } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import { encryptPayload } from '@/utils/encryptPayload';
import { buildUrl } from '@/utils/buildUrl';
import { toast } from 'react-toastify';

interface PaymentParams {
  phantomWalletPublicKey: PublicKey;
  token: string;
  session?: string;
  sharedSecret?: Uint8Array;
  dappPair?: nacl.BoxKeyPair;
  amountOverride?: number;
}

export const usePhantomPayment = () => {
  const processPayment = useCallback(
    async (params: PaymentParams): Promise<string | null> => {
      const { phantomWalletPublicKey, token, session, sharedSecret, dappPair, amountOverride } = params;

      const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|Pod/.test(navigator.userAgent);
      const isMobileFlow = Boolean(session && sharedSecret && dappPair);

      try {
        const connection = new Connection(
          process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com'
        );

        const receiver = new PublicKey(process.env.NEXT_PUBLIC_RECEIVER_WALLET || '');

        const amount = amountOverride ?? parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.001');
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: phantomWalletPublicKey,
            toPubkey: receiver,
            lamports,
          })
        );

        transaction.feePayer = phantomWalletPublicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        // Desktop flow: sign transaction with Phantom extension
        if (!isMobile && typeof window !== 'undefined' && window.solana?.isPhantom) {
          console.log('Desktop payment flow: signing with Phantom extension');
          const signedTx = await window.solana.signAndSendTransaction(transaction);
          await connection.confirmTransaction(signedTx.signature);
          console.log('Transaction confirmed:', signedTx.signature);
          return signedTx.signature;
        }

        // Mobile flow: send transaction via Deeplink
        if (isMobile && isMobileFlow) {
          console.log('Mobile payment flow: building deeplink');
          const serializedTx = transaction.serialize({ requireAllSignatures: false });
          const payload = { session, transaction: bs58.encode(serializedTx) };
          const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret!);

          const params = new URLSearchParams({
            dapp_encryption_key: bs58.encode(dappPair!.publicKey),
            nonce: bs58.encode(nonce),
            redirect_link: `${window.location.origin}/phantom-redirect?action=signTransaction`,
            payload: bs58.encode(encryptedPayload),
          });

          const signUrl = buildUrl('signTransaction', params);

          // Save payment status to sessionStorage to detect after redirect
          sessionStorage.setItem('phantom_payment_pending', 'true');
          sessionStorage.setItem('phantom_payment_timestamp', Date.now().toString());

          console.log('Redirecting to:', signUrl);
          window.location.href = signUrl;

          return 'MOBILE_PAYMENT_REDIRECT';
        }

        throw new Error('Unsupported platform for payment');
      } catch (error) {
        toast.error('Ошибка при обработке платежа');
        console.error('Payment error:', error);
        throw error;
      }
    },
    []
  );

  const handlePaymentResult = useCallback(
    (result: any, pendingData: any, completeCallback: (data: any, signature: string) => void) => {
      if (!pendingData || !completeCallback) return;

      if (result?.success && result.signature) {
        toast.success('Платеж успешно подтверждён');
        completeCallback(pendingData, result.signature);
      } else {
        toast.error('Ошибка при обработке платежа');
      }
    },
    []
  );

  return { processPayment, handlePaymentResult };
};
