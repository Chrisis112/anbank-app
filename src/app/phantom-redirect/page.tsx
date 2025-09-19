'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { decryptPayload } from '@/utils/decryptPayload';
import bs58 from 'bs58';

export default function PhantomRedirect() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');

        if (action === 'connect') {
          const data = urlParams.get('data');
          const nonce = urlParams.get('nonce');
          const phantomEncryptionPublicKey = urlParams.get('phantom_encryption_public_key');

          if (data && nonce && phantomEncryptionPublicKey) {
            // Получаем dappKeyPair из localStorage
            const savedKeyPair = localStorage.getItem('dappKeyPair_secretKey');
            if (!savedKeyPair) {
              throw new Error('DappKeyPair не найден');
            }

            const secretKey = bs58.decode(savedKeyPair);
            const dappKeyPair = {
              secretKey,
              publicKey: secretKey.slice(32, 64),
            };

            // Генерируем sharedSecret
            const sharedSecret = nacl.box.before(
              bs58.decode(phantomEncryptionPublicKey),
              dappKeyPair.secretKey
            );

            // Расшифровываем данные подключения
            const connectData = decryptPayload(data, nonce, sharedSecret);

            // Сохраняем данные подключения
            localStorage.setItem('phantom_public_key', connectData.public_key);
            localStorage.setItem('phantom_session', connectData.session);
            localStorage.setItem('phantom_shared_secret', bs58.encode(sharedSecret));

            // Возвращаемся на главную страницу
            router.push('/');
            return;
          }
        } else if (action === 'signAndSendTransaction') {
          const data = urlParams.get('data');
          const nonce = urlParams.get('nonce');

          if (data && nonce) {
            const sharedSecretString = localStorage.getItem('phantom_shared_secret');
            if (!sharedSecretString) {
              throw new Error('SharedSecret не найден');
            }

            const sharedSecret = bs58.decode(sharedSecretString);
            const decrypted = decryptPayload(data, nonce, sharedSecret);

            if (decrypted.signature) {
              // Сохраняем результат платежа
              sessionStorage.setItem('phantom_payment_result', JSON.stringify({
                success: true,
                signature: decrypted.signature,
              }));
            } else {
              sessionStorage.setItem('phantom_payment_result', JSON.stringify({
                success: false,
                error: 'Подпись не получена',
              }));
            }

            // Возвращаемся на главную страницу
            router.push('/');
            return;
          }
        }

        // Если что-то пошло не так - возвращаемся на главную
        router.push('/');
      } catch (error) {
        console.error('Error processing redirect:', error);
        sessionStorage.setItem('phantom_payment_result', JSON.stringify({
          success: false,
          error: 'Ошибка обработки результата',
        }));
        router.push('/');
      }
    };

    handleRedirect();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Обработка запроса Phantom...</h1>
        <p>Пожалуйста, подождите</p>
      </div>
    </div>
  );
}
