import bs58 from 'bs58';
import nacl from 'tweetnacl';

const encodeUTF8 = (str: string) => new TextEncoder().encode(str);
const decodeUTF8 = (buf: Uint8Array) => new TextDecoder().decode(buf);

export const generateRandomNonce = (): string => {
  return bs58.encode(nacl.randomBytes(24));
};

export const encryptPayload = (
  payload: any,
  nonceBase58: string,
  dappPublicKey: string,
  phantomPublicKey: string,
  dappPrivateKey: Uint8Array
): string => {
  const nonce = bs58.decode(nonceBase58);
  const phantomPubKey = bs58.decode(phantomPublicKey);
  const message = encodeUTF8(JSON.stringify(payload));
  
  const encrypted = nacl.box(message, nonce, phantomPubKey, dappPrivateKey);
  return bs58.encode(encrypted);
};

export const decryptPayload = (
  encryptedBase58: string,
  nonceBase58: string,
  phantomPublicKey: string,
  dappPrivateKey: string
): any | null => {
  try {
    // Попробуем несколько способов расшифровки
    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const dappPrivKey = bs58.decode(dappPrivateKey);

    // Способ 1: С Phantom public key (если есть)
    if (phantomPublicKey) {
      const phantomPubKey = bs58.decode(phantomPublicKey);
      const decrypted = nacl.box.open(encrypted, nonce, phantomPubKey, dappPrivKey);
      if (decrypted) {
        return JSON.parse(decodeUTF8(decrypted));
      }
    }

    // Способ 2: С dApp public key
    const dappPubKey = localStorage.getItem('phantom_dapp_public_key');
    if (dappPubKey) {
      const phantomPubKey = bs58.decode(dappPubKey);
      const decrypted = nacl.box.open(encrypted, nonce, phantomPubKey, dappPrivKey);
      if (decrypted) {
        return JSON.parse(decodeUTF8(decrypted));
      }
    }

    // Способ 3: Возможно данные не зашифрованы (прямое декодирование)
    try {
      return JSON.parse(decodeUTF8(encrypted));
    } catch (e) {
      // Игнорируем
    }

    // Способ 4: Base64 декодирование
    try {
      const base64Decoded = atob(encryptedBase58);
      return JSON.parse(base64Decoded);
    } catch (e) {
      // Игнорируем
    }

    console.error('All decryption methods failed');
    return null;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};
