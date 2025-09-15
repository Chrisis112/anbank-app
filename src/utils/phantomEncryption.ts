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

export function decryptPayload(
  encryptedBase58: string,
  nonceBase58: string,
  phantomPublicKey: string,
  dappPrivateKey: string
): any | null {
  try {
    if (!encryptedBase58) throw new Error('Encrypted payload is empty');
    if (!nonceBase58) throw new Error('Nonce is empty');
    if (!dappPrivateKey) throw new Error('dApp private key is empty');

    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const dappPrivKey = bs58.decode(dappPrivateKey);

    console.group('decryptPayload debug');
    console.log('Encrypted (base58) start:', encryptedBase58.slice(0, 20) + '...');
    console.log('Encrypted (hex) start:', Buffer.from(encrypted).slice(0, 20).toString('hex') + '...');
    console.log('Nonce (base58):', nonceBase58);
    console.log('Nonce (hex):', Buffer.from(nonce).toString('hex'));
    console.log('Nonce length:', nonce.length);
    console.log('dApp PrivateKey (base58) start:', dappPrivateKey.slice(0, 20) + '...');
    console.log('dApp PrivateKey (hex):', Buffer.from(dappPrivKey).toString('hex'));
    console.log('dApp PrivateKey length:', dappPrivKey.length);

    let phantomPubKey: Uint8Array;
    if (phantomPublicKey) {
      phantomPubKey = bs58.decode(phantomPublicKey);
      console.log('Phantom PublicKey (base58) start:', phantomPublicKey.slice(0, 20) + '...');
      console.log('Phantom PublicKey (hex):', Buffer.from(phantomPubKey).toString('hex'));
      console.log('Phantom PublicKey length:', phantomPubKey.length);
    } else {
      const dappPubKey = localStorage.getItem('phantom_dapp_public_key');
      if (!dappPubKey) throw new Error('Missing dApp public key in localStorage');
      phantomPubKey = bs58.decode(dappPubKey);
      console.log('Fallback to dApp PublicKey (base58) start:', dappPubKey.slice(0, 20) + '...');
      console.log('Fallback to dApp PublicKey (hex):', Buffer.from(phantomPubKey).toString('hex'));
      console.log('Fallback to dApp PublicKey length:', phantomPubKey.length);
    }

    if (phantomPubKey.length !== 32) {
      throw new Error(`Invalid public key length: ${phantomPubKey.length}`);
    }
    if (dappPrivKey.length !== 32) {
      throw new Error(`Invalid private key length: ${dappPrivKey.length}`);
    }
    if (nonce.length !== 24) {
      throw new Error(`Invalid nonce length: ${nonce.length}`);
    }

    const decrypted = nacl.box.open(encrypted, nonce, phantomPubKey, dappPrivKey);
    if (!decrypted) {
      console.error('nacl.box.open returned null (decryption failed)');
      return null;
    }

    const decoded = decodeUTF8(decrypted);
    console.groupEnd();
    return JSON.parse(decoded);

  } catch (error) {
    console.error('decryptPayload error:', error);
    return null;
  }
}
