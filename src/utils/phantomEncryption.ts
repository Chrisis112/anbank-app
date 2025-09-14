// phantomEncryption.ts

import bs58 from "bs58";
import nacl from "tweetnacl";

const encodeUTF8 = (str: string) => new TextEncoder().encode(str);
const decodeUTF8 = (buf: Uint8Array) => new TextDecoder().decode(buf);

export const generateRandomNonce = (): string =>
  bs58.encode(nacl.randomBytes(24));

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
      throw new Error("Missing required inputs for decryption");
    }

    const encrypted = bs58.decode(encryptedBase58);
    const nonce = bs58.decode(nonceBase58);
    const dappPrivKey = bs58.decode(dappPrivateKey);
    if (dappPrivKey.length !== 32) {
      throw new Error(`Invalid dApp private key length: ${dappPrivKey.length}`);
    }

    let phantomPubKey: Uint8Array;
    if (phantomPublicKey) {
      phantomPubKey = bs58.decode(phantomPublicKey);
      if (phantomPubKey.length !== 32) {
        throw new Error(`Invalid Phantom public key length: ${phantomPubKey.length}`);
      }
    } else {
      const dappPubKey = localStorage.getItem("phantom_dapp_public_key");
      if (!dappPubKey) {
        throw new Error("Missing dApp public key in localStorage");
      }
      phantomPubKey = bs58.decode(dappPubKey);
      if (phantomPubKey.length !== 32) {
        throw new Error(`Invalid dApp public key length: ${phantomPubKey.length}`);
      }
    }

    const decrypted = nacl.box.open(encrypted, nonce, phantomPubKey, dappPrivKey);
    if (!decrypted) {
      console.error("nacl.box.open returned null");
      return null;
    }

    const decoded = decodeUTF8(decrypted);
    return JSON.parse(decoded);
  } catch (e) {
    console.error("Decryption error:", e);
    return null;
  }
};
