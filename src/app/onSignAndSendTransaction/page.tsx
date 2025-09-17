'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { toast } from 'react-toastify';
import { decryptPayload } from '@/utils/decryptPayload';

export default function OnSignAndSendTransactionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function processResponse() {
      try {
        const encodedPayload = searchParams.get('payload');
        const encodedNonce = searchParams.get('nonce');
        if (!encodedPayload || !encodedNonce) {
          throw new Error('Отсутствуют необходимые параметры');
        }

        // Получить общий ключ приложения из localStorage
        const encodedSecretKey = localStorage.getItem('dappKeyPair_secretKey');
        if (!encodedSecretKey) throw new Error('Ключ приложения не найден');

        const secretKey = bs58.decode(encodedSecretKey);
     const encodedSharedSecretBase58 = localStorage.getItem('phantom_shared_secret');
if (!encodedSharedSecretBase58) throw new Error('Shared secret не найден');
const sharedSecret = bs58.decode(encodedSharedSecretBase58);

        // Расшифровка
        const decryptedData = decryptPayload(
          encodedPayload,
          encodedNonce,
          sharedSecret
        );

        toast.success('Платеж прошёл успешно!');
        setTimeout(() => router.push('/chat'), 3000);
      } catch (e) {
        toast.error('Ошибка обработки ответа платежа');
        setTimeout(() => router.push('/'), 3000);
      } finally {
        setLoading(false);
      }
    }
    processResponse();
  }, [searchParams, router]);

  if (loading) {
    return <p>Обработка платежа...</p>;
  }

  return <p>Обработка завершена</p>;
}
