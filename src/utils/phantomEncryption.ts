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
    if (!encryptedBase58 || !nonceBase58 || !dappPrivateKey) {
      throw new Error('Missing required input for decryption');
    }

    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const dappPrivKey = bs58.decode(dappPrivateKey);

    console.group('decryptPayload debug');
    console.log('Encrypted (base58):', encryptedBase58.slice(0, 10) + '...');
    console.log('Encrypted (hex):', Buffer.from(encrypted).slice(0, 10).toString('hex') + '...');
    console.log('Nonce (base58):', nonceBase58);
    console.log('Nonce (hex):', Buffer.from(nonce).toString('hex'));
    console.log('DApp PrivateKey (base58):', dappPrivateKey.slice(0, 10) + '...');
    console.log('DApp PrivateKey (hex):', Buffer.from(dappPrivKey).toString('hex'));
    console.log('DApp PrivateKey length:', dappPrivKey.length);

    if (phantomPublicKey) {
      const phantomPubKeyDecoded = bs58.decode(phantomPublicKey);
      console.log('Phantom PublicKey (base58):', phantomPublicKey.slice(0, 10) + '...');
      console.log('Phantom PublicKey (hex):', Buffer.from(phantomPubKeyDecoded).toString('hex'));
      console.log('Phantom PublicKey length:', phantomPubKeyDecoded.length);

      if (phantomPubKeyDecoded.length !== 32) {
        throw new Error(`Invalid Phantom PublicKey length: ${phantomPubKeyDecoded.length}`);
      }

      const decrypted = nacl.box.open(encrypted, nonce, phantomPubKeyDecoded, dappPrivKey);

      if (!decrypted) {
        console.error('Decryption failed with Phantom PublicKey');
        return null;
      }

      const decoded = decodeUTF8(decrypted);
      console.groupEnd();
      return JSON.parse(decoded);
    } else {
      const dappPubKey = localStorage.getItem('phantom_dapp_public_key');
      if (!dappPubKey) {
        throw new Error('Missing dApp PublicKey');
      }

      const dappPubKeyDecoded = bs58.decode(dappPubKey);

      console.log('Using fallback dApp PublicKey (base58):', dappPubKey.slice(0, 10) + '...');
      console.log('Using fallback dApp PublicKey (hex):', Buffer.from(dappPubKeyDecoded).toString('hex'));
      console.log('Fallback dApp PublicKey length:', dappPubKeyDecoded.length);

      if (dappPubKeyDecoded.length !== 32) {
        throw new Error(`Invalid dApp PublicKey length: ${dappPubKeyDecoded.length}`);
      }

      const decrypted = nacl.box.open(encrypted, nonce, dappPubKeyDecoded, dappPrivKey);

      if (!decrypted) {
        console.error('Decryption failed with fallback dApp PublicKey');
        return null;
      }

      const decoded = decodeUTF8(decrypted);
      console.groupEnd();
      return JSON.parse(decoded);
    }

  } catch (error) {
    console.error('decryptPayload error:', error);
    return null;
  }
}