// hooks/usePhantomPayment.ts
import { useState, useCallback, useEffect } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'https://api.mainnet-beta.solana.com';
const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || '';
const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.36');

interface PaymentResult {
  signature: string | null;
  success: boolean;
  error?: string;
  txHash?: string;
}

interface PaymentOptions {
  skipPreflight?: boolean;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  maxRetries?: number;
}

export const usePhantomPayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  const { 
    publicKey, 
    sendTransaction, 
    connected, 
    signTransaction, 
    wallet,
    connecting,
    disconnecting 
  } = useWallet();
  const { connection } = useConnection();

  // Определяем тип устройства
  useEffect(() => {
    const checkMobileDevice = () => {
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      setIsMobileDevice(mobileRegex.test(userAgent));
    };

    checkMobileDevice();
  }, []);

  // Создание оптимизированной транзакции для мобильных устройств
  const createOptimizedTransaction = useCallback(async (
    fromPubkey: PublicKey,
    toPubkey: PublicKey,
    amount: number,
    connection: Connection
  ): Promise<Transaction | VersionedTransaction> => {
    
    // Получаем актуальный blockhash с максимальной совместимостью
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
      commitment: 'confirmed'
    });

    if (isMobileDevice) {
      // Для мобильных используем VersionedTransaction (более совместим с MWA)
      const instructions = [
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      ];

      const messageV0 = new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      return new VersionedTransaction(messageV0);
    } else {
      // Для браузера используем обычную Transaction
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey,
      });

      const transferInstruction = SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      });

      transaction.add(transferInstruction);
      return transaction;
    }
  }, [isMobileDevice]);

  // Отправка транзакции с учетом типа устройства
  const sendOptimizedTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options: PaymentOptions = {}
  ): Promise<string> => {
    const {
      skipPreflight = false,
      commitment = 'confirmed',
      maxRetries = 3
    } = options;

    try {
      if (isMobileDevice) {
        // Мобильная стратегия: используем sendTransaction с дополнительными опциями
        return await sendTransaction(transaction as any, connection, {
          skipPreflight,
          preflightCommitment: commitment,
          maxRetries,
          // Дополнительные опции для мобильных устройств
          minContextSlot: undefined,
        });
      } else {
        // Браузерная стратегия
        if (transaction instanceof VersionedTransaction) {
          return await sendTransaction(transaction as any, connection, {
            skipPreflight,
            preflightCommitment: commitment,
          });
        } else {
          return await sendTransaction(transaction, connection, {
            skipPreflight,
            preflightCommitment: commitment,
          });
        }
      }
    } catch (error: any) {
      console.error('Ошибка отправки транзакции:', error);
      
      // Попытка альтернативного метода для мобильных устройств
      if (isMobileDevice && signTransaction) {
        console.log('Пробуем альтернативный метод подписания для мобильного...');
        
        try {
          const signedTransaction = await signTransaction(transaction as Transaction);
          return await connection.sendRawTransaction(
            signedTransaction.serialize(),
            {
              skipPreflight,
              preflightCommitment: commitment,
              maxRetries,
            }
          );
        } catch (altError: any) {
          console.error('Альтернативный метод также не сработал:', altError);
          throw new Error(`Не удалось отправить транзакцию: ${altError.message}`);
        }
      }
      
      throw error;
    }
  }, [isMobileDevice, sendTransaction, signTransaction]);

  const processPayment = useCallback(async (
    customOptions: PaymentOptions = {}
  ): Promise<PaymentResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Проверки
      if (connecting || disconnecting) {
        throw new Error('Кошелек в процессе подключения/отключения. Попробуйте позже.');
      }

      if (!connected || !publicKey) {
        throw new Error('Кошелек не подключен. Пожалуйста, подключите кошелек.');
      }

      if (!RECEIVER_WALLET) {
        throw new Error('Адрес получателя не настроен в переменных окружения.');
      }

      if (!wallet) {
        throw new Error('Кошелек не инициализирован.');
      }

      // Проверяем баланс
      const balance = await connection.getBalance(publicKey);
      const requiredAmount = Math.floor(SOL_AMOUNT * LAMPORTS_PER_SOL);
      const estimatedFee = 5000; // примерная комиссия в lamports

      if (balance < requiredAmount + estimatedFee) {
        throw new Error(
          `Недостаточно средств. Требуется: ${(requiredAmount + estimatedFee) / LAMPORTS_PER_SOL} SOL, доступно: ${balance / LAMPORTS_PER_SOL} SOL`
        );
      }

      console.log(`Обработка платежа на ${isMobileDevice ? 'мобильном' : 'десктоп'} устройстве...`);

      // Создаем получателя
      const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

      // Создаем оптимизированную транзакцию
      const transaction = await createOptimizedTransaction(
        publicKey,
        receiverPublicKey,
        SOL_AMOUNT,
        connection
      );

      console.log('Транзакция создана, отправляем...');

      // Отправляем транзакцию
      const signature = await sendOptimizedTransaction(transaction, connection, {
        skipPreflight: false,
        commitment: 'confirmed',
        maxRetries: 5,
        ...customOptions,
      });

      console.log('Транзакция отправлена, подпись:', signature);

      // Получаем blockhash для подтверждения
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');

      // Подтверждаем транзакцию
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Транзакция отклонена сетью: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('Транзакция подтверждена успешно!');

      return {
        signature,
        success: true,
        txHash: signature,
      };

    } catch (err: any) {
      let errorMessage = 'Неизвестная ошибка при обработке платежа';
      
      // Обработка специфических ошибок
      if (err.message) {
        if (err.message.includes('User rejected')) {
          errorMessage = 'Пользователь отклонил транзакцию';
        } else if (err.message.includes('Signature verification failed')) {
          errorMessage = 'Ошибка подписи транзакции. Попробуйте переподключить кошелек.';
        } else if (err.message.includes('insufficient funds')) {
          errorMessage = 'Недостаточно средств для совершения транзакции';
        } else if (err.message.includes('Missing signature')) {
          errorMessage = 'Ошибка подписания транзакции. Убедитесь, что кошелек разблокирован.';
        } else if (err.message.includes('Network request failed') || err.message.includes('timeout')) {
          errorMessage = 'Проблема с сетевым соединением. Попробуйте еще раз.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      console.error('Детали ошибки платежа:', {
        error: err,
        message: err.message,
        stack: err.stack,
        isMobile: isMobileDevice,
        wallet: wallet?.adapter?.name,
      });

      return {
        signature: null,
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [
    publicKey,
    connected,
    connecting,
    disconnecting,
    wallet,
    connection,
    createOptimizedTransaction,
    sendOptimizedTransaction,
    isMobileDevice
  ]);

  return {
    processPayment,
    isLoading,
    error,
    isConnected: connected,
    publicKey: publicKey?.toString() || null,
    walletName: wallet?.adapter?.name || null,
    isMobileDevice,
    clearError: () => setError(null),
    retryPayment: () => processPayment(),
  };
};
