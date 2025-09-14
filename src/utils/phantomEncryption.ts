import bs58 from 'bs58';
import nacl from 'tweetnacl';

const encodeUTF8 = (str: string) => new TextEncoder().encode(str);
const decodeUTF8 = (buf: Uint8Array) => new TextDecoder().decode(buf);

export const generateRandomNonce = (): string => {
  return bs58.encode(nacl.randomBytes(24));
};

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
  dappEncryptionPublicKey: string,
  phantomPublicKey: string,
  dappPrivateKeyUint8Array: Uint8Array
): string => {
  const nonce = bs58.decode(nonceBase58);
  const phantomPubKey = bs58.decode(phantomPublicKey);
  const message = encodeUTF8(JSON.stringify(payload));

  const encrypted = nacl.box(message, nonce, phantomPubKey, dappPrivateKeyUint8Array);

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
      throw new Error('Missing required decryption inputs');
    }

    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const dappPrivKeyDecoded = bs58.decode(dappPrivateKey);
    if (dappPrivKeyDecoded.length !== 32) {
      throw new Error(`Invalid dApp private key length: ${dappPrivKeyDecoded.length}`);
    }

    let phantomPubKeyDecoded: Uint8Array;

    if (phantomPublicKey) {
      phantomPubKeyDecoded = bs58.decode(phantomPublicKey);
      if (phantomPubKeyDecoded.length !== 32) {
        throw new Error(`Invalid Phantom public key length: ${phantomPubKeyDecoded.length}`);
      }
    } else {
      // При отсутствии Phantom public key используем DApp публичный ключ
      const dappPubKey = localStorage.getItem('phantom_dapp_public_key');
      if (!dappPubKey) {
        throw new Error('DApp public key missing in localStorage');
      }
      phantomPubKeyDecoded = bs58.decode(dappPubKey);
      if (phantomPubKeyDecoded.length !== 32) {
        throw new Error(`Invalid DApp public key length: ${phantomPubKeyDecoded.length}`);
      }
    }

    const decrypted = nacl.box.open(encrypted, nonce, phantomPubKeyDecoded, dappPrivKeyDecoded);

    if (!decrypted) {
      console.error('Failed to decrypt: nacl.box.open returned null');
      return null;
    }

    const decoded = decodeUTF8(decrypted);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};
