import bs58 from 'bs58';
import nacl from 'tweetnacl';

// Встроенный utf8 кодировщик и декодировщик (замена tweetnacl-util)
const encodeUTF8 = (str: string): Uint8Array => new TextEncoder().encode(str);
const decodeUTF8 = (buf: Uint8Array): string => new TextDecoder().decode(buf);

// Генерация случайного nonce (24 байта) в base58
export const generateRandomNonce = (): string => {
  const nonce = nacl.randomBytes(24);
  return bs58.encode(nonce);
};

// Шифрование payload (объект) с использованием публичного ключа Phantom dApp
// dappEncryptionPublicKey и phantomPublicKey - base58 строки ключей
// dappPrivateKeyUintArray - приватный ключ Uint8Array
export const encryptPayload = (
  payload: any,
  nonceBase58: string,
  dappEncryptionPublicKey: string,
  phantomPublicKey: string,
  dappPrivateKeyUintArray: Uint8Array
): string => {
  const nonce = bs58.decode(nonceBase58);
  const dappPublicKey = bs58.decode(dappEncryptionPublicKey);
  const phantomPublicKeyBytes = bs58.decode(phantomPublicKey);
  // Кодируем строку payload в Uint8Array
  const message = encodeUTF8(JSON.stringify(payload));
  // Шифруем payload
  const encrypted = nacl.box(message, nonce, phantomPublicKeyBytes, dappPrivateKeyUintArray);
  return bs58.encode(encrypted);
};

// Расшифровка payload
export const decryptPayload = (
  encryptedBase58: string,
  nonceBase58: string,
  phantomPublicKeyBase58: string,
  dappPrivateKeyBase58: string
): any | null => {
  try {
    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const phantomPublicKey = bs58.decode(phantomPublicKeyBase58);
    const dappPrivateKey = bs58.decode(dappPrivateKeyBase58);

    const decrypted = nacl.box.open(encrypted, nonce, phantomPublicKey, dappPrivateKey);
    if (!decrypted) return null;

    const jsonStr = decodeUTF8(decrypted);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
};
