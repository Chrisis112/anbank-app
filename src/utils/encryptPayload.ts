import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const encryptPayload = (
  payload: any,
  sharedSecret?: Uint8Array
): [Uint8Array, Uint8Array] => {
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
