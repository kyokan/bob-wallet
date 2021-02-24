import CryptoJS from 'crypto-js';

export function encrypt(text, password) {
  return CryptoJS.AES.encrypt(text, password).toString();
}

export function decrypt(ciphertext, password) {
  const bytes  = CryptoJS.AES.decrypt(ciphertext, password);
  return bytes.toString(CryptoJS.enc.Utf8);
}
