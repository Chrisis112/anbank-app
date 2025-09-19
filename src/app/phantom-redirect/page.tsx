'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { decryptPayload } from '@/utils/decryptPayload';

export default function PhantomRedirect() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');

      // Получаем все параметры из URL
      const data = urlParams.get('data');
      const nonce = urlParams.get('nonce');
      const phantomEncryptionPublicKey = urlParams.get('phantom_encryption_public_key');

      if (action === 'connect' && data && nonce && phantomEncryptionPublicKey) {
        // Отправляем данные в родительское окно
        if (window.opener) {
          window.opener.postMessage({
            type: 'PHANTOM_DEEPLINK',
            url: window.location.href,
          }, window.location.origin);
          window.close();
        }
      } else if (action === 'signAndSendTransaction') {
        // Обработка результата транзакции
        try {
          const sharedSecret = localStorage.getItem('phantom_shared_secret');
          if (sharedSecret && data && nonce) {
            const decrypted = decryptPayload(data, nonce, new Uint8Array(Buffer.from(sharedSecret, 'base64')));
            
            if (window.opener) {
              window.opener.postMessage({
                type: 'PHANTOM_PAYMENT_RESULT',
                result: {
                  success: true,
                  signature: decrypted.signature,
                },
              }, window.location.origin);
              window.close();
            }
          }
        } catch (error) {
          if (window.opener) {
            window.opener.postMessage({
              type: 'PHANTOM_PAYMENT_RESULT',
              result: {
                success: false,
                error: 'Failed to process transaction result',
              },
            }, window.location.origin);
            window.close();
          }
        }
      }

      // Если нет opener, перенаправляем на главную
      if (!window.opener) {
        router.push('/');
      }
    };

    handleRedirect();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Обработка запроса...</h1>
        <p>Пожалуйста, подождите</p>
      </div>
    </div>
  );
}
