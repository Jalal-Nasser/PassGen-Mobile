import CryptoJS from 'crypto-js';

export interface PasswordEntry {
  id: string;
  name: string;
  password: string;
  username?: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export class EncryptionService {
  private masterPassword: string;

  constructor(masterPassword: string) {
    this.masterPassword = masterPassword;
  }

  encryptPassword(password: string): string {
    return CryptoJS.AES.encrypt(password, this.masterPassword).toString();
  }

  decryptPassword(encryptedPassword: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, this.masterPassword);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  encryptEntry(entry: PasswordEntry): string {
    const jsonString = JSON.stringify(entry);
    return CryptoJS.AES.encrypt(jsonString, this.masterPassword).toString();
  }

  decryptEntry(encryptedData: string): PasswordEntry {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.masterPassword);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  }

  encryptEntries(entries: PasswordEntry[]): string {
    const jsonString = JSON.stringify(entries);
    return CryptoJS.AES.encrypt(jsonString, this.masterPassword).toString();
  }

  decryptEntries(encryptedData: string): PasswordEntry[] {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.masterPassword);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  }

  generateHash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }
}
