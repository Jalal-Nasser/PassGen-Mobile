import { EncryptionService, PasswordEntry } from './encryption';
import { ConfigStore, StorageConfig } from './configStore';

export class StorageManager {
  private encryption: EncryptionService | null = null;
  private configStore: ConfigStore;
  private currentConfig: StorageConfig | null = null;

  constructor() {
    this.configStore = new ConfigStore();
    this.currentConfig = this.configStore.getStorageConfig();
  }

  initializeEncryption(masterPassword: string): void {
    this.encryption = new EncryptionService(masterPassword);
  }

  async initializeStorage(config: StorageConfig): Promise<void> {
    this.currentConfig = config;
    this.configStore.setStorageConfig(config);

    // Don't initialize cloud services in browser context
    // They'll be initialized when actually needed (in Electron main process)
    console.log('Storage configured:', config.provider);
  }

  async savePasswordEntry(entry: PasswordEntry): Promise<void> {
    if (!this.encryption) {
      throw new Error('Encryption not initialized. Please set master password.');
    }

    const encryptedData = this.encryption.encryptEntry(entry);
    const filename = `password-${entry.id}.json`;

    switch (this.currentConfig?.provider) {
      case 'local':
        // Save to localStorage for now
        const existingData = localStorage.getItem('passgen-vault-data');
        const vault = existingData ? JSON.parse(existingData) : [];
        vault.push({ filename, data: encryptedData });
        localStorage.setItem('passgen-vault-data', JSON.stringify(vault));
        break;

      case 'google-drive':
      case 's3':
      case 'digitalocean':
        // Cloud storage will be implemented via IPC in future update
        alert('Cloud storage sync coming soon! For now, passwords are saved locally.');
        const localData = localStorage.getItem('passgen-vault-data');
        const localVault = localData ? JSON.parse(localData) : [];
        localVault.push({ filename, data: encryptedData });
        localStorage.setItem('passgen-vault-data', JSON.stringify(localVault));
        break;

      default:
        throw new Error('No storage provider configured');
    }
  }

  async getAllPasswordEntries(): Promise<PasswordEntry[]> {
    if (!this.encryption) {
      throw new Error('Encryption not initialized');
    }

    const entries: PasswordEntry[] = [];

    // Load from localStorage for all providers (temporary until IPC is implemented)
    const vaultData = localStorage.getItem('passgen-vault-data');
    if (vaultData) {
      const vault = JSON.parse(vaultData);
      for (const item of vault) {
        try {
          const entry = this.encryption.decryptEntry(item.data);
          entries.push(entry);
        } catch (error) {
          console.error(`Failed to decrypt entry:`, error);
        }
      }
    }

    return entries;
  }

  getGoogleDriveAuthUrl(): string {
    // Will be implemented via IPC in future update
    return '';
  }

  async authenticateGoogleDrive(_code: string): Promise<void> {
    // Will be implemented via IPC in future update
    console.log('Google Drive auth will be implemented via IPC');
  }

  getCurrentProvider(): string {
    return this.currentConfig?.provider || 'none';
  }

  getStorageConfig(): StorageConfig | null {
    return this.configStore.getStorageConfig();
  }

  /**
   * Clears all local data and configuration so the app restarts the wizard.
   * This removes: storage config, master hash, and locally saved encrypted vault data.
   */
  resetApp(): void {
    try {
      // Clear config and master hash
      if (typeof this.configStore.clear === 'function') {
        // @ts-ignore allow calling clear if defined in our ConfigStore implementation
        this.configStore.clear();
      }

      // Clear any key starting with 'passgen-' to be thorough
      Object.keys(localStorage)
        .filter(k => k.toLowerCase().startsWith('passgen-'))
        .forEach(k => localStorage.removeItem(k));

      // Reset in-memory state
      this.currentConfig = null;
      this.encryption = null;
    } catch (e) {
      console.error('Failed to reset app state:', e);
    }
  }
}
