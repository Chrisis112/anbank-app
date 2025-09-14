import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

// Генерация случайного nonce (24 байта) в base58
export const generateRandomNonce = (): string => {
  const nonce = nacl.randomBytes(24);
  return bs58.encode(nonce);
};

// Шифрование payload (объект) с использованием публичного ключа Phantom dApp
// dappEncryptionPublicKey должен быть base58 строкой публичного ключа Phantom dApp
export const encryptPayload = (
  payload: any,
  nonceBase58: string,
  dappEncryptionPublicKeyBase58: string,
  phantomPublicKeyBase58: string
): string => {
  // Конвертация ключей и nonce из base58 в Uint8Array
  const nonce = bs58.decode(nonceBase58);
  const dappPublicKey = bs58.decode(dappEncryptionPublicKeyBase58);
  const phantomPublicKey = bs58.decode(phantomPublicKeyBase58);

  // Кодируем payload в Uint8Array
  const message = decodeUTF8(JSON.stringify(payload));

  // Шифрование с использованием libsodium "box" (nacl.box)
  // Используем пару ключей: dappPrivateKey (нужно хранить в dApp), phantomPublicKey
  // Так как private key dApp на фронте хранить нельзя, здесь пример только заглушка:

  // В реальном приложении private key dApp должен храниться безопасно
  // Ниже простой пример шифрования с фиктивным ключом (НЕ БЕЗОПАСНО)
  const dappPrivateKey = new Uint8Array(32); // Здесь вставьте приватный ключ dApp (секретный)
  const encrypted = nacl.box(message, nonce, phantomPublicKey, dappPrivateKey);

  return bs58.encode(encrypted);
};
