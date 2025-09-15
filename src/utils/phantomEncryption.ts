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
      throw new Error("Missing required inputs for decryption");
    }

    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const dappPrivKey = bs58.decode(dappPrivateKey);

    // ====== ВАЖНО! ДЛЯ ОТЛАДКИ: ======
    console.log("decryptPayload: dApp Private Key (b58):", dappPrivateKey);
    console.log("decryptPayload: dApp Private Key (hex):", Buffer.from(dappPrivKey).toString('hex'));
    console.log("decryptPayload: dApp Private Key length:", dappPrivKey.length);

    let phantomPubKey: Uint8Array;
    if (phantomPublicKey) {
      phantomPubKey = bs58.decode(phantomPublicKey);
      console.log("decryptPayload: Phantom Public Key (b58):", phantomPublicKey);
      console.log("decryptPayload: Phantom Public Key (hex):", Buffer.from(phantomPubKey).toString('hex'));
      console.log("decryptPayload: Phantom Public Key length:", phantomPubKey.length);
    } else {
      const dappPubKey = localStorage.getItem("phantom_dapp_public_key");
      phantomPubKey = dappPubKey ? bs58.decode(dappPubKey) : new Uint8Array(0);
      console.log("decryptPayload: (fallback) dApp Public Key (b58):", dappPubKey);
      console.log("decryptPayload: (fallback) dApp Public Key (hex):", Buffer.from(phantomPubKey).toString('hex'));
      console.log("decryptPayload: (fallback) dApp Public Key length:", phantomPubKey.length);
    }

    console.log("decryptPayload: Nonce (b58):", nonceBase58);
    console.log("decryptPayload: Nonce (hex):", Buffer.from(nonce).toString('hex'));
    console.log("decryptPayload: Nonce length:", nonce.length);

    console.log("decryptPayload: Encrypted (b58, first 20):", encryptedBase58.slice(0, 20) + "...");
    console.log("decryptPayload: Encrypted (hex, first 20):", Buffer.from(encrypted).toString('hex').slice(0, 40) + "...");

    const decrypted = nacl.box.open(encrypted, nonce, phantomPubKey, dappPrivKey);

    if (!decrypted) {
      console.error("nacl.box.open returned null");
      return null;
    }

    const decoded = decodeUTF8(decrypted);
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
};
