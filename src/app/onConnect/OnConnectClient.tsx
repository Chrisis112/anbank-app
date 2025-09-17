'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { toast } from 'react-toastify';
import { decryptPayload } from '@/utils/decryptPayload';
import { usePhantomPayment } from '@/hooks/usePhantomPayment';
import { PublicKey } from '@solana/web3.js';

const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || "0.36");

function getDappKeyPair(): nacl.BoxKeyPair | null {
  try {
    const encodedSecretKey = localStorage.getItem('dappKeyPair_secretKey');
    if (!encodedSecretKey) return null;
    const secretKey = bs58.decode(encodedSecretKey);
    const keyPair = {
      publicKey: secretKey.slice(32),
      secretKey,
    };
    return keyPair;
  } catch {
    return null;
  }
}

export default function OnConnectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processPayment } = usePhantomPayment();

  const [phantomWalletPublicKey, setPhantomWalletPublicKey] = useState<PublicKey | null>(null);
  const [sharedSecret, setSharedSecret] = useState<Uint8Array | undefined>();
  const [session, setSession] = useState<string | undefined>();
  const [readyForPayment, setReadyForPayment] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [dappKeyPair, setDappKeyPair] = useState<nacl.BoxKeyPair | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const phantom_encryption_public_key = searchParams.get('phantom_encryption_public_key');
    const nonce = searchParams.get('nonce');
    const data = searchParams.get('data');
    const errorCode = searchParams.get('errorCode');
    const errorMessage = searchParams.get('errorMessage');

    if (errorCode) {
      toast.error(`Phantom connection error: ${errorMessage || errorCode}`);
      router.replace('/');
      return;
    }

    if (phantom_encryption_public_key && nonce && data) {
      try {
        const encodedDappSecretKey = localStorage.getItem('dappKeyPair_secretKey');
        if (!encodedDappSecretKey) throw new Error('Нет локального ключа приложения для дешифровки данных');
        const dappSecret = bs58.decode(encodedDappSecretKey);

        const sharedSecretDapp = nacl.box.before(
          bs58.decode(phantom_encryption_public_key),
          dappSecret
        );

        const connectData = decryptPayload(
          data,
          nonce,
          sharedSecretDapp
        );

        localStorage.setItem('phantom_session', connectData.session);
        localStorage.setItem('phantom_public_key', connectData.public_key);

        setSharedSecret(sharedSecretDapp);
        setSession(connectData.session);
        setPhantomWalletPublicKey(new PublicKey(connectData.public_key));

        toast.success('Phantom Wallet успешно подключен!');

        setDappKeyPair({
          publicKey: dappSecret.slice(32),
          secretKey: dappSecret,
        });

        // Готовы к запуску оплаты
        setReadyForPayment(true);

      } catch (e) {
        toast.error('Ошибка при обработке ответа от Phantom');
        setTimeout(() => router.replace('/'), 1500);
      }
    }
  }, [router, searchParams]);

  const handleStartPayment = async () => {
    if (!phantomWalletPublicKey || !session || !sharedSecret || !dappKeyPair) {
      toast.error('Отсутствуют данные для оплаты');
      return;
    }
    setPaymentInProgress(true);
    try {
      const paymentResult = await processPayment({
        phantomWalletPublicKey,
        session,
        sharedSecret,
        dappKeyPair,
      }, SOL_AMOUNT);

      if (!paymentResult) {
        toast.error('Оплата не была завершена');
        setPaymentInProgress(false);
        return;
      }

      // Переадресация после успешной оплаты
      router.replace('/chat');
    } catch (error) {
      toast.error('Ошибка при оплате');
    } finally {
      setPaymentInProgress(false);
    }
  };

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>Phantom подключение!</h1>
      <p>Обработка ответа от Phantom Wallet</p>

      {readyForPayment && !paymentInProgress && (
        <button 
          onClick={handleStartPayment} 
          style={{ marginTop: 20, padding: '10px 20px', fontSize: 16 }}
        >
          Оплатить {SOL_AMOUNT} SOL
        </button>
      )}

      {paymentInProgress && <p>Платеж в процессе...</p>}
    </div>
  );
}
