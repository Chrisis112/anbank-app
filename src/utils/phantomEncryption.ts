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
    if (!encryptedBase58 || !nonceBase58 || !dappPrivateKey) {
      throw new Error('Missing required input');
    }

    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const dappPrivKey = bs58.decode(dappPrivateKey);

    console.group('decryptPayload debug');
    console.log('Encrypted (base58) prefix:', encryptedBase58.slice(0, 20) + '...');
    console.log('Encrypted length:', encrypted.length);
    console.log('Nonce (base58):', nonceBase58);
    console.log('Nonce length:', nonce.length);
    console.log('DApp private key (base58 prefix):', dappPrivateKey.slice(0, 20) + '...');
    console.log('DApp private key length:', dappPrivKey.length);

    let phantomPubKey: Uint8Array;
    if (phantomPublicKey) {
      phantomPubKey = bs58.decode(phantomPublicKey);
      console.log('Phantom public key (base58 prefix):', phantomPublicKey.slice(0, 20) + '...');
      console.log('Phantom public key length:', phantomPubKey.length);
    } else {
      const fallbackPubKeyBase58 = localStorage.getItem('phantom_dapp_public_key');
      if (!fallbackPubKeyBase58) {
        throw new Error('Missing fallback public key');
      }
      phantomPubKey = bs58.decode(fallbackPubKeyBase58);
      console.log('Fallback (dApp) public key (base58 prefix):', fallbackPubKeyBase58.slice(0, 20) + '...');
      console.log('Fallback public key length:', phantomPubKey.length);
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
    console.groupEnd();
    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error('decryptPayload error:', error);
    return null;
  }
};