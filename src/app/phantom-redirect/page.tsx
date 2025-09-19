'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { decryptPayload } from '@/utils/decryptPayload';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';

export default function PhantomRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function handleRedirect() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');

        if (action === 'connect') {
          const data = urlParams.get('data');
          const nonce = urlParams.get('nonce');
          const phantomEncryptionPublicKey = urlParams.get('phantom_encryption_public_key');

          if (data && nonce && phantomEncryptionPublicKey) {
            const savedKeyPair = localStorage.getItem('dappKeyPair_secretKey');
            if (!savedKeyPair) {
              throw new Error('DappKeyPair не найден');
            }

            const secretKey = bs58.decode(savedKeyPair);
            const dappKeyPair = {
              secretKey,
              publicKey: secretKey.slice(32, 64), // Исправлено: публичный ключ это с 32 по 64 байт
            };

            const sharedSecret = nacl.box.before(
              bs58.decode(phantomEncryptionPublicKey),
              dappKeyPair.secretKey
            );

            const connectData = decryptPayload(data, nonce, sharedSecret);

            localStorage.setItem('phantom_public_key', connectData.public_key);
            localStorage.setItem('phantom_session', connectData.session);
            localStorage.setItem('phantom_shared_secret', bs58.encode(sharedSecret));

            console.log('Phantom connected:', connectData.public_key);
            await router.push('/');
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
              sessionStorage.setItem('phantom_payment_result', JSON.stringify({
                success: true,
                signature: decrypted.signature,
              }));
              console.log('Payment succeeded with signature:', decrypted.signature);
            } else {
              sessionStorage.setItem('phantom_payment_result', JSON.stringify({
                success: false,
                error: 'Подпись не получена',
              }));
              console.error('Payment signature not received');
            }

            await router.push('/');
            return;
          }
        }

        await router.push('/');
      } catch (error: any) {
        console.error('Error processing redirect:', error);
        sessionStorage.setItem('phantom_payment_result', JSON.stringify({
          success: false,
          error: 'Ошибка обработки результата',
        }));
        await router.push('/');
      }
    }

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
