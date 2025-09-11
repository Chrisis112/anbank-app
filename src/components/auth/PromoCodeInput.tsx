'use client';

import { useState } from 'react';
import axios from 'axios';

type PromoCodeInputProps = {
  onSuccess: (promoCode: string) => void; // для вызова при удачной проверке
  onFail?: (message: string) => void;     // опционально, можно отдать ошибку наверх
  disabled?: boolean;                     // блокировать поле во внешнем состоянии
  className?: string;                     // стилизация извне
};

export default function PromoCodeInput({
  onSuccess,
  onFail,
  disabled = false,
  className = ''
}: PromoCodeInputProps) {
  const [promoCode, setPromoCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  // Автоматическая проверка при изменении
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim().toUpperCase();
    setPromoCode(value);
    setMessage('');
    setIsValid(null);

    // Проверять только если длина >=5 (можно задать другую минимальную)
    if (value.length >= 5) {
      setIsChecking(true);
      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/validate-promo`,
          { promoCode: value }
        );
        if (data.valid) {
          setIsValid(true);
          setMessage(data.description || 'Промо-код действителен!');
          onSuccess(value);
        } else {
          setIsValid(false);
          setMessage(data.message || 'Промо-код недействителен или истёк.');
          onFail?.(data.message || 'Промо-код недействителен.');
        }
      } catch (error: any) {
        setIsValid(false);
        setMessage(error?.response?.data?.error || 'Ошибка проверки промо-кода.');
        onFail?.(error?.response?.data?.error || 'Ошибка проверки.');
      } finally {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
      setIsValid(null);
      setMessage('');
    }
  };

  // Ручная проверка, если нужна кнопка
  const manualCheck = async () => {
    if (!promoCode || promoCode.length < 5) {
      setMessage('Введите промо-код полностью.');
      setIsValid(null);
      return;
    }
    setIsChecking(true);
    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/validate-promo`,
        { promoCode }
      );
      if (data.valid) {
        setIsValid(true);
        setMessage(data.description || 'Промо-код действителен!');
        onSuccess(promoCode);
      } else {
        setIsValid(false);
        setMessage(data.message || 'Промо-код недействителен или истёк.');
        onFail?.(data.message || 'Промо-код недействителен.');
      }
    } catch (error: any) {
      setIsValid(false);
      setMessage(error?.response?.data?.error || 'Ошибка проверки промо-кода.');
      onFail?.(error?.response?.data?.error || 'Ошибка проверки.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <label className="block mb-1 text-white font-semibold">Промо-код (если есть)</label>
      <div className="relative">
        <input
          type="text"
          value={promoCode}
          onChange={handleChange}
          disabled={disabled}
          className={`w-full p-3 rounded-lg border-2 bg-crypto-input text-white font-light 
            transition focus:outline-none focus:ring-2 placeholder-gray-400
            ${isValid === true
              ? 'border-green-500 focus:ring-green-500'
              : isValid === false
              ? 'border-red-500 focus:ring-red-500'
              : 'border-crypto-accent focus:ring-crypto-accent'}
          `}
          placeholder="Введите промо-код"
        />
        {/* Индикация проверки */}
        {isChecking && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-crypto-accent"></div>
          </div>
        )}
        {isValid === true && (
          <div className="absolute right-3 top-3 text-green-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {isValid === false && (
          <div className="absolute right-3 top-3 text-red-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      {/* Сообщение о валидации */}
      {message && (
        <p className={`mt-2 text-sm ${isValid ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      {/* Кнопка ручной проверки (по желанию) */}
      {/* <button
        type="button"
        onClick={manualCheck}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        disabled={!promoCode || isChecking}
      >
        Проверить промо-код
      </button> */}
    </div>
  );
}
