import bs58 from 'bs58';
import { generateRandomNonce, encryptPayload } from '@/utils/phantomEncryption';

// dappKeys — ключи вашего dapp (public/private)
// phantomPublicKey — публичный ключ пользователя Phantom (base58)
// transaction — объект Transaction из @solana/web3.js, подготовленный к подписанию
// redirectUrl — URL вашего сайта, куда Phantom вернёт результат

async function createPhantomMobileDeeplink(transaction: { serializeMessage: () => any; }, dappKeys: { publicKey: string; privateKey: string; }, phantomPublicKey: string, redirectUrl: string | number | boolean) {
  const nonce = generateRandomNonce();

  const serializedMessage = transaction.serializeMessage();

  const base58Transaction = bs58.encode(serializedMessage);

  const payload = { transaction: base58Transaction };

  const encryptedPayload = encryptPayload(
    payload,
    nonce,
    dappKeys.publicKey,
    phantomPublicKey,
    bs58.decode(dappKeys.privateKey),
  );

  const encodedRedirectUrl = encodeURIComponent(redirectUrl);

  const deeplink = `https://phantom.app/ul/v1/signTransaction?` +
    `dapp_encryption_public_key=${dappKeys.publicKey}` +
    `&nonce=${nonce}` +
    `&redirect_url=${encodedRedirectUrl}` +
    `&payload=${encryptedPayload}`;

  return deeplink;
}
