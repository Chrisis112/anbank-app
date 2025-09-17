'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { toast } from 'react-toastify';
import { decryptPayload } from '@/utils/decryptPayload';

export default function OnConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Получаем параметры только в браузере
    if (typeof window === 'undefined') return;

    const phantom_encryption_public_key = searchParams.get('phantom_encryption_public_key');
    const nonce = searchParams.get('nonce');
    const data = searchParams.get('data');
    const errorCode = searchParams.get('errorCode');
    const errorMessage = searchParams.get('errorMessage');

    if (errorCode) {
      toast.error(`Phantom connection error: ${errorMessage || errorCode}`);
      router.replace('/'); // Вернуть пользователя на главную
      return;
    }

    if (phantom_encryption_public_key && nonce && data) {
      try {
        // Получаем ранее сгенерированный dappKeyPair из localStorage
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
        setTimeout(() => router.replace('/chat'), 2000);
      } catch (e) {
        toast.error('Ошибка при обработке ответа от Phantom');
        setTimeout(() => router.replace('/'), 1500);
      }
    }
  }, [router, searchParams]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>Phantom подключение!</h1>
      <p>Обработка ответа от Phantom Wallet...</p>
    </div>
  );
}
