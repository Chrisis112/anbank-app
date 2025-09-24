import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const generateRandomNonce = (): string => bs58.encode(nacl.randomBytes(24));


export const decryptPayload = (
data: string, nonce: string, phantomPublicKeyInStorage: string, dappPrivateKey: string, sharedSecret?: Uint8Array) => {
  if (!sharedSecret) throw new Error('missing shared secret');
  
  const decryptedData = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    sharedSecret
  );
  
  if (!decryptedData) {
    throw new Error('Unable to decrypt data');
  }
  
  return JSON.parse(Buffer.from(decryptedData).toString('utf8'));
};


export const encryptPayload = (
payload: any, sharedSecret?: Uint8Array, publicKey?: string, phantomPublicKey?: string, p0?: Uint8Array<ArrayBufferLike>): [Uint8Array, Uint8Array] => {
  if (!sharedSecret) throw new Error('missing shared secret');
  
  const nonce = nacl.randomBytes(24);
  const payloadStr = JSON.stringify(payload);
  const encryptedPayload = nacl.box.after(
    Buffer.from(payloadStr, 'utf8'),
    nonce,
    sharedSecret
  );
  
  return [nonce, encryptedPayload];
};
