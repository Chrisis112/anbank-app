import bs58 from 'bs58';
import nacl from 'tweetnacl';

const encodeUTF8 = (str: string) => new TextEncoder().encode(str);
const decodeUTF8 = (buf: Uint8Array) => new TextDecoder().decode(buf);

export const generateRandomNonce = (): string => {
  return bs58.encode(nacl.randomBytes(24));
};

// Генерация пары ключей dApp для шифрования
export const generateDappKeypair = () => {
  const keypair = nacl.box.keyPair();
  return {
    publicKey: bs58.encode(keypair.publicKey),
    privateKey: bs58.encode(keypair.secretKey),
  };
};

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

  // Шифруем используя публичный ключ Phantom и приватный ключ dApp
  const encrypted = nacl.box(message, nonce, phantomPublicKey, dappPrivateKeyUint8Array);

  return bs58.encode(encrypted);
};
export const decryptPayload = (
  encryptedBase58: string,
  nonceBase58: string,
  phantomPublicKeyBase58: string,
  dappPrivateKeyBase58: string
): any | null => {
  try {
    if (!encryptedBase58) throw new Error('Encrypted payload is empty');
    if (!nonceBase58) throw new Error('Nonce is empty');
    if (!dappPrivateKeyBase58) throw new Error('dApp private key is empty');

    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const dappPrivateKey = bs58.decode(dappPrivateKeyBase58);

    console.log('dappPrivateKey length:', dappPrivateKey.length);
    console.log('Encrypted data length:', encrypted.length);
    console.log('Nonce length:', nonce.length);

    if (dappPrivateKey.length !== 32) {
      throw new Error(`dApp private key has invalid length: ${dappPrivateKey.length}`);
    }

    // Попробуем несколько вариантов расшифровки
    let decrypted = null;

    // Вариант 1: Если есть phantom public key, используем его
    if (phantomPublicKeyBase58) {
      const phantomPublicKey = bs58.decode(phantomPublicKeyBase58);
      if (phantomPublicKey.length === 32) {
        console.log('Trying decryption with Phantom public key...');
        decrypted = nacl.box.open(encrypted, nonce, phantomPublicKey, dappPrivateKey);
        if (decrypted) {
          console.log('Decryption successful with Phantom key');
          const jsonStr = decodeUTF8(decrypted);
          return JSON.parse(jsonStr);
        }
      }
    }

    // Вариант 2: Попробуем с dApp публичным ключом (для connect операций)
    const dappPublicKey = localStorage.getItem('phantom_dapp_public_key');
    if (dappPublicKey) {
      const dappPublicKeyDecoded = bs58.decode(dappPublicKey);
      if (dappPublicKeyDecoded.length === 32) {
        console.log('Trying decryption with dApp public key...');
        decrypted = nacl.box.open(encrypted, nonce, dappPublicKeyDecoded, dappPrivateKey);
        if (decrypted) {
          console.log('Decryption successful with dApp key');
          const jsonStr = decodeUTF8(decrypted);
          return JSON.parse(jsonStr);
        }
      }
    }

    // Вариант 3: Возможно, данные не зашифрованы (для некоторых операций)
    try {
      console.log('Trying direct base64/JSON decode...');
      const directDecode = decodeUTF8(encrypted);
      const parsed = JSON.parse(directDecode);
      console.log('Direct decode successful');
      return parsed;
    } catch (e) {
      console.log('Direct decode failed:', e);
    }

    // Вариант 4: Попробуем декодировать как base64
    try {
      console.log('Trying base64 decode...');
      const base64Decoded = atob(encryptedBase58);
      const parsed = JSON.parse(base64Decoded);
      console.log('Base64 decode successful');
      return parsed;
    } catch (e) {
      console.log('Base64 decode failed:', e);
    }

    console.error('All decryption methods failed');
    return null;

  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};
