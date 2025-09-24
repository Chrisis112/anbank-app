import { useState, useCallback, useEffect } from 'react';
import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
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
    disconnecting,
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

  // Создание VersionedTransaction (оптимизированно для Phantom mobile)
  const createOptimizedTransaction = useCallback(
    async (
      fromPubkey: PublicKey,
      toPubkey: PublicKey,
      amount: number,
      connection: Connection
    ): Promise<VersionedTransaction> => {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
        commitment: 'confirmed',
      });

      const instructions = [
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        }),
      ];

      const messageV0 = new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      return new VersionedTransaction(messageV0);
    },
    []
  );

  // Отправка транзакции с поддержкой mobile signTransaction + sendRawTransaction
  const sendOptimizedTransaction = useCallback(
    async (
      transaction: VersionedTransaction,
      connection: Connection,
      options: PaymentOptions = {}
    ): Promise<string> => {
      const { skipPreflight = false, commitment = 'confirmed', maxRetries = 3 } = options;

      if (isMobileDevice && signTransaction) {
        // Мобильная версия: подписываем и отправляем вручную
        try {
          const signedTx = await signTransaction(transaction as any);
          const rawTx = signedTx.serialize();
          const txid = await connection.sendRawTransaction(rawTx, {
            skipPreflight,
            preflightCommitment: commitment,
            maxRetries,
          });
          return txid;
        } catch (error) {
          console.error('Ошибка signTransaction/sendRawTransaction:', error);
          throw error;
        }
      } else {
        // Десктоп и браузерная версия
        try {
          return await sendTransaction(transaction, connection, {
            skipPreflight,
            preflightCommitment: commitment,
            maxRetries,
          });
        } catch (error) {
          console.error('Ошибка sendTransaction:', error);
          throw error;
        }
      }
    },
    [isMobileDevice, signTransaction, sendTransaction, connection]
  );

  // Основная функция оплаты
  const processPayment = useCallback(
    async (customOptions: PaymentOptions = {}): Promise<PaymentResult> => {
      setIsLoading(true);
      setError(null);

      try {
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

        const balance = await connection.getBalance(publicKey);
        const requiredAmount = Math.floor(SOL_AMOUNT * LAMPORTS_PER_SOL);
        const estimatedFee = 5000; // примерная комиссия в lamports

        if (balance < requiredAmount + estimatedFee) {
          throw new Error(
            `Недостаточно средств. Требуется: ${(requiredAmount + estimatedFee) / LAMPORTS_PER_SOL} SOL, доступно: ${balance / LAMPORTS_PER_SOL} SOL`
          );
        }

        const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

        const transaction = await createOptimizedTransaction(
          publicKey,
          receiverPublicKey,
          SOL_AMOUNT,
          connection
        );

        const signature = await sendOptimizedTransaction(transaction, connection, {
          skipPreflight: false,
          commitment: 'confirmed',
          maxRetries: 5,
          ...customOptions,
        });

        const latestBlockhash = await connection.getLatestBlockhash('confirmed');

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

        return {
          signature,
          success: true,
          txHash: signature,
        };
      } catch (err: any) {
        let errorMessage = 'Неизвестная ошибка при обработке платежа';

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
    },
    [
      publicKey,
      connected,
      connecting,
      disconnecting,
      wallet,
      connection,
      createOptimizedTransaction,
      sendOptimizedTransaction,
      isMobileDevice,
    ]
  );

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
