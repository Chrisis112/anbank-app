import { useState, useCallback } from 'react';
import { Transaction, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Connection, clusterApiUrl } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { toast } from 'react-toastify';
import { encryptPayload } from '@/utils/encryptPayload';

function buildUrl(action: string, params: URLSearchParams): string {
  const base = 'https://phantom.app/ul/v1';
  return `${base}/${action}?${params.toString()}`;
}

const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || '';
const SOL_AMOUNT = parseFloat(process.env.NEXT_PUBLIC_SOL_AMOUNT || '0.36');

const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_NETWORK || clusterApiUrl('mainnet-beta');
const connection = new Connection(rpcUrl);

const onSignAndSendTransactionRedirectLink = typeof window !== 'undefined'
  ? `${window.location.origin}/onSignAndSendTransaction`
  : '/onSignAndSendTransaction';

interface PaymentParams {
  phantomWalletPublicKey: PublicKey | null;
  session: string | undefined;
  sharedSecret: Uint8Array | undefined;
  dappKeyPair: nacl.BoxKeyPair;
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
}

export const usePhantomPayment = () => {
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const processPayment = useCallback(async (
    params: PaymentParams,
    customAmount?: number
  ): Promise<string | null> => {
    const { phantomWalletPublicKey, session, sharedSecret, dappKeyPair } = params;

    if (!phantomWalletPublicKey || !session || !sharedSecret) {
      toast.error('Phantom Wallet не подключен');
      return null;
    }

    if (!RECEIVER_WALLET) {
      toast.error('Адрес получателя не настроен');
      return null;
    }

    setIsProcessingPayment(true);

    try {
      const amount = customAmount || SOL_AMOUNT;
      if (amount <= 0) {
        throw new Error('Некорректная сумма платежа');
      }

      const lamports = amount * LAMPORTS_PER_SOL;

      // Проверка баланса
      const balance = await connection.getBalance(phantomWalletPublicKey);
      if (balance < lamports + 5000) {
        throw new Error('Недостаточно средств на балансе');
      }

      const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

      // Создание транзакции
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: phantomWalletPublicKey,
          toPubkey: receiverPublicKey,
          lamports: Math.floor(lamports),
        })
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      transaction.feePayer = phantomWalletPublicKey;

      if (isMobileDevice()) {
        // Мобильное устройство — используем deeplink
        const serializedTransaction = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });

        const payload = {
          session,
          transaction: bs58.encode(serializedTransaction),
        };

        const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

        const urlParams = new URLSearchParams({
          dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
          nonce: bs58.encode(nonce),
          redirect_link: onSignAndSendTransactionRedirectLink,
          payload: bs58.encode(encryptedPayload),
        });
console.log('Deeplink parameters:');
console.log('dapp_encryption_public_key:', bs58.encode(dappKeyPair.publicKey));
console.log('nonce:', bs58.encode(nonce));
console.log('redirect_link:', onSignAndSendTransactionRedirectLink);
console.log('payload length:', encryptedPayload.length);
console.log('payload (base58 encoded):', bs58.encode(encryptedPayload));


        const url = buildUrl("signAndSendTransaction", urlParams);
        window.open(url, "_blank");
        toast.info('Подтвердите транзакцию в Phantom Wallet');
        return 'TRANSACTION_SENT_FOR_SIGNING';
      } else {
        // Десктоп — используем расширение Phantom Wallet
        //@ts-ignore
        const provider = window.solana;
        if (!provider?.isPhantom) {
          throw new Error('Phantom расширение не найдено');
        }

        const signedTransaction = await provider.signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTransaction.serialize());
        await connection.confirmTransaction(txid);

        toast.success(`Платеж успешно отправлен, TxID: ${txid}`);

        return txid;
      }
    } catch (error: any) {
      console.error('Ошибка обработки платежа:', error);
      toast.error(`Ошибка платежа: ${error?.message || 'Неизвестная ошибка'}`);
      return null;
    } finally {
      setIsProcessingPayment(false);
    }
  }, []);

  return {
    processPayment,
    isProcessingPayment,
  };
};
