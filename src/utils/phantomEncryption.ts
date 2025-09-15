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
  // Use the provided nonce instead of generating new one
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
    if (!encryptedBase58) throw new Error('Encrypted payload is empty');
    if (!nonceBase58) throw new Error('Nonce is empty');
    if (!dappPrivateKey) throw new Error('dApp private key is empty');

    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    // Fix: dappPrivateKey is already Uint8Array, don't decode it again
    const dappPrivKey = typeof dappPrivateKey === 'string' ? bs58.decode(dappPrivateKey) : dappPrivateKey;

    let phantomPubKey: Uint8Array;
    if (phantomPublicKey) {
      phantomPubKey = bs58.decode(phantomPublicKey);
    } else {
      const fallbackPubKeyBase58 = localStorage.getItem('phantom_dapp_public_key');
      if (!fallbackPubKeyBase58) {
        throw new Error('Missing fallback public key');
      }
      phantomPubKey = bs58.decode(fallbackPubKeyBase58);
    }

    if (phantomPubKey.length !== 32 || dappPrivKey.length !== 32 || nonce.length !== 24) {
      throw new Error(
        `Invalid key or nonce lengths: pubKey=${phantomPubKey.length}, privKey=${dappPrivKey.length}, nonce=${nonce.length}`
      );
    }

    const decrypted = nacl.box.open(encrypted, nonce, phantomPubKey, dappPrivKey);
    if (!decrypted) {
      console.error('nacl.box.open returned null (decryption failed)');
      return null;
    }

    const decryptedStr = decodeUTF8(decrypted);
    return JSON.parse(decryptedStr);

  } catch (error) {
    console.error('decryptPayload error:', error);
    return null;
  }
};
