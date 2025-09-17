'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { toast } from 'react-toastify';
import { decryptPayload } from '@/utils/decryptPayload';
import { usePhantomPayment } from '@/hooks/usePhantomPayment'; // Ваш хук оплаты
import { PublicKey } from '@solana/web3.js';

const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || "0.36");

export default function OnConnectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    processPayment,
  } = usePhantomPayment();


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
      (async () => {
        try {
          const encodedDappSecretKey = localStorage.getItem('dappKeyPair_secretKey');
          if (!encodedDappSecretKey) throw new Error('Нет локального ключа приложения для дешифровки данных');
          const dappSecretKey = bs58.decode(encodedDappSecretKey);

          const sharedSecret = nacl.box.before(
            bs58.decode(phantom_encryption_public_key),
            dappSecretKey
          );
          const connectData = decryptPayload(
            data,
            nonce,
            sharedSecret
          );

          localStorage.setItem('phantom_session', connectData.session);
          localStorage.setItem('phantom_public_key', connectData.public_key);

          toast.success('Phantom Wallet успешно подключен!');

          // Запускаем оплату, используя processPayment с указанной суммой
          const solanaPublicKey = connectData.public_key;
          const session = connectData.session;
          const dappKeyPair = getDappKeyPair();
if (!dappKeyPair) {
  toast.error('Ключи приложения не найдены');
  return;
}
          // processPayment должен принимать данные пользователя (ключ, сессию и сумму)
          await processPayment({
            phantomWalletPublicKey: new PublicKey(solanaPublicKey),
            session,
            sharedSecret,
            dappKeyPair, // если нужно передать
          }, SOL_AMOUNT);

          // После оплаты перенаправляем на чат или другую страницу
          router.replace('/chat');

        } catch (e) {
          console.error(e);
          toast.error('Ошибка при обработке ответа от Phantom');
          setTimeout(() => router.replace('/'), 1500);
        }
      })();
    }
  }, [router, searchParams, processPayment]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>Phantom подключение!</h1>
      <p>Обработка ответа от Phantom Wallet и оплата...</p>
    </div>
  );
}
