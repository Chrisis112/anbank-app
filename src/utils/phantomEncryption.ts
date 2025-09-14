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
    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const phantomPublicKey = bs58.decode(phantomPublicKeyBase58);
    const dappPrivateKey = bs58.decode(dappPrivateKeyBase58);

    console.log('phantomPublicKey length:', phantomPublicKey.length);
    console.log('dappPrivateKey length:', dappPrivateKey.length);

    if (phantomPublicKey.length !== 32) {
      throw new Error(`Phantom public key has invalid length: ${phantomPublicKey.length}`);
    }
    if (dappPrivateKey.length !== 32) {
      throw new Error(`dApp private key has invalid length: ${dappPrivateKey.length}`);
    }

    const decrypted = nacl.box.open(encrypted, nonce, phantomPublicKey, dappPrivateKey);
    if (!decrypted) return null;

    const jsonStr = decodeUTF8(decrypted);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};
