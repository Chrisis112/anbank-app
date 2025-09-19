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

        console.log('PhantomRedirect: handling action:', action);
        console.log('PhantomRedirect: URL params:', urlParams.toString());

        if (action === 'connect') {
          const data = urlParams.get('data');
          const nonce = urlParams.get('nonce');
          const phantomEncryptionPublicKey = urlParams.get('phantom_encryption_public_key');

          console.log('Connect action - data:', !!data, 'nonce:', !!nonce, 'publicKey:', !!phantomEncryptionPublicKey);

          if (data && nonce && phantomEncryptionPublicKey) {
            const savedKeyPair = localStorage.getItem('dappKeyPair_secretKey');
            if (!savedKeyPair) {
              throw new Error('DappKeyPair не найден');
            }

            const secretKey = bs58.decode(savedKeyPair);
            const dappKeyPair = {
              secretKey,
              publicKey: secretKey.slice(32, 64), // публичный ключ - вторые 32 байта
            };

            const sharedSecret = nacl.box.before(
              bs58.decode(phantomEncryptionPublicKey),
              dappKeyPair.secretKey
            );

            const connectData = decryptPayload(data, nonce, sharedSecret);
            
            console.log('Decrypted connect data:', connectData);

            localStorage.setItem('phantom_public_key', connectData.public_key);
            localStorage.setItem('phantom_session', connectData.session);
            localStorage.setItem('phantom_shared_secret', bs58.encode(sharedSecret));

            console.log('Phantom connected successfully:', connectData.public_key);
            await router.push('/');
            return;
          }
        } else if (action === 'signAndSendTransaction') {
          const data = urlParams.get('data');
          const nonce = urlParams.get('nonce');

          console.log('SignAndSend action - data:', !!data, 'nonce:', !!nonce);

          if (data && nonce) {
            const sharedSecretString = localStorage.getItem('phantom_shared_secret');
            if (!sharedSecretString) {
              throw new Error('SharedSecret не найден');
            }

            const sharedSecret = bs58.decode(sharedSecretString);
            const decrypted = decryptPayload(data, nonce, sharedSecret);

            console.log('Decrypted payment data:', decrypted);

            if (decrypted.signature) {
              sessionStorage.setItem('phantom_payment_result', JSON.stringify({
                success: true,
                signature: decrypted.signature,
              }));
              console.log('Payment successful, signature:', decrypted.signature);
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

        console.log('No valid action found, redirecting to home');
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
