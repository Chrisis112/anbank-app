"use client"
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { toast } from 'react-toastify';
import { decryptPayload } from '@/utils/decryptPayload';

export default function OnConnectPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    const { phantom_encryption_public_key, nonce, data, errorCode, errorMessage } = router.query;

    if (errorCode) {
      toast.error(`Phantom connection error: ${errorMessage || errorCode}`);
      router.replace('/'); // Вернуть пользователя на главную
      return;
    }

    if (phantom_encryption_public_key && nonce && data) {
      try {
        // Получить ранее сгенерированный dappKeyPair из localStorage или контекста
        const encodedDappSecretKey = localStorage.getItem('dappKeyPair_secretKey');
        if (!encodedDappSecretKey) throw new Error('Нет локального ключа приложения для дешифровки данных');
        const dappSecretKey = bs58.decode(encodedDappSecretKey);

        const sharedSecret = nacl.box.before(
          bs58.decode(phantom_encryption_public_key as string),
          dappSecretKey
        );
        const connectData = decryptPayload(
          data as string,
          nonce as string,
          sharedSecret
        );

        // Пример: сохранение публичного ключа и сессии
        localStorage.setItem('phantom_session', connectData.session);
        localStorage.setItem('phantom_public_key', connectData.public_key);

        toast.success('Phantom Wallet подключен!');
        setTimeout(() => router.replace('/chat'), 2000);
      } catch (e) {
        toast.error('Ошибка при обработке ответа от Phantom');
        setTimeout(() => router.replace('/'), 1500);
      }
    }
  }, [router.isReady, router.query, router]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>Phantom подключение!</h1>
      <p>Обработка ответа от Phantom Wallet...</p>
    </div>
  );
}
