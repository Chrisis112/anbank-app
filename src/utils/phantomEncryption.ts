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
// dappEncryptionPublicKeyBase58 и phantomPublicKeyBase58 - base58 строки ключей
// dappPrivateKeyUint8Array - секретный приватный ключ dApp Uint8Array (32 байта)
export const encryptPayload = (
  payload: any,
  nonceBase58: string,
  dappEncryptionPublicKeyBase58: string,
  phantomPublicKeyBase58: string,
  dappPrivateKeyUint8Array: Uint8Array
): string => {
  const nonce = bs58.decode(nonceBase58);
  const phantomPublicKey = bs58.decode(phantomPublicKeyBase58);

  const message = encodeUTF8(JSON.stringify(payload));

  // Шифрование с использованием libsodium "box"
  const encrypted = nacl.box(message, nonce, phantomPublicKey, dappPrivateKeyUint8Array);

  return bs58.encode(encrypted);
};

// Расшифровка payload (для примера, если понадобится)
export const decryptPayload = (
  encryptedBase58: string,
  nonceBase58: string,
  phantomPublicKeyBase58: string,
  dappPrivateKeyUint8Array: Uint8Array
): any | null => {
  const encrypted = bs58.decode(encryptedBase58);
  const nonce = bs58.decode(nonceBase58);
  const phantomPublicKey = bs58.decode(phantomPublicKeyBase58);

  const decrypted = nacl.box.open(encrypted, nonce, phantomPublicKey, dappPrivateKeyUint8Array);
  if (!decrypted) {
    return null; // Ошибка расшифровки
  }
  const decodedStr = decodeUTF8(decrypted);
  try {
    return JSON.parse(decodedStr);
  } catch {
    return null;
  }
};
