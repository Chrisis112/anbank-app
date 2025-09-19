import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

export function decryptPayload(
  data: string,
  nonce: string,
  sharedSecret: Uint8Array
): any {
  try {
    const encryptedData = bs58.decode(data);
    const nonceArray = bs58.decode(nonce);

    // Используем метод подписи с общим секретом
    const decrypted = nacl.box.open.after(encryptedData, nonceArray, sharedSecret);
    if (!decrypted) {
      throw new Error('Failed to decrypt payload');
    }

    const decryptedText = new TextDecoder().decode(decrypted);
    return JSON.parse(decryptedText);
  } catch (error) {
    console.error('Decrypt error:', error);
    throw error;
  }
}
