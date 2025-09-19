import * as nacl from 'tweetnacl';

export function encryptPayload(
  payload: any,
  sharedSecret: Uint8Array
): [Uint8Array, Uint8Array] {
  try {
    const message = new TextEncoder().encode(JSON.stringify(payload));
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(message, nonce, sharedSecret);
    
    return [nonce, encrypted];
  } catch (error) {
    console.error('Encrypt error:', error);
    throw error;
  }
}
