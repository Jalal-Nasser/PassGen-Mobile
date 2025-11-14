// Simple localStorage-based config store
// No Node.js dependencies - safe for renderer process

export interface StorageConfig {
  provider: 'local' | 'google-drive' | 's3' | 'digitalocean';
  googleDrive?: {
    clientId: string;
    clientSecret: string;
    tokens?: any;
  };
  s3?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
  };
  digitalocean?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
  };
}

export class ConfigStore {
  getInstallId(): string {
    let id = localStorage.getItem('passgen-install-id')
    if (!id) {
      // Generate simple UUID v4-ish
      const rnd = (len: number) => Array.from(crypto?.getRandomValues?.(new Uint8Array(len)) || new Array(len).fill(0).map(()=>Math.random()*256), (b:any)=>('00'+(b|0).toString(16)).slice(-2)).join('')
      id = `${rnd(4)}-${rnd(2)}-${rnd(2)}-${rnd(2)}-${rnd(6)}`
      localStorage.setItem('passgen-install-id', id)
    }
    return id
  }

  getUserEmail(): string {
    return localStorage.getItem('passgen-user-email') || ''
  }

  setUserEmail(email: string): void {
    localStorage.setItem('passgen-user-email', email)
  }

  private getSellerSecret(): string {
    // Prefer runtime-configurable secret so you can avoid hardcoding
    return (
      (window as any)?.PASSGEN_SELLER_SECRET ||
      localStorage.getItem('passgen-seller-secret') ||
      (import.meta as any)?.env?.VITE_SELLER_SECRET ||
      'PG-SEC-2025' // fallback
    )
  }

  computeActivationCode(email?: string): string {
    const installId = this.getInstallId()
    const secret = this.getSellerSecret()
    const data = `${installId}|${(email || this.getUserEmail() || '').trim().toLowerCase()}|${secret}`
  // Try CryptoJS from renderer bundle (fallback)
    try {
      // dynamic require may not exist; use global CryptoJS if bundled
      const CryptoJS = (window as any).CryptoJS
      if (CryptoJS) {
        const digest = CryptoJS.SHA256(data).toString()
        return digest.substring(0, 10).toUpperCase()
      }
    } catch {}
    // Extremely simple fallback (not cryptographically strong)
    let x = 0
    for (let i = 0; i < data.length; i++) x = (x * 31 + data.charCodeAt(i)) >>> 0
    return ("00000000" + x.toString(16)).slice(-8).toUpperCase()
  }

  verifyActivationCode(code: string, email?: string): boolean {
    return this.computeActivationCode(email) === code.trim().toUpperCase()
  }
  isPremium(): boolean {
    return localStorage.getItem('passgen-premium') === 'true'
  }

  setPremium(value: boolean): void {
    localStorage.setItem('passgen-premium', value ? 'true' : 'false')
  }

  getStorageConfig(): StorageConfig | null {
    const stored = localStorage.getItem('passgen-storage-config');
    return stored ? JSON.parse(stored) : null;
  }

  setStorageConfig(config: StorageConfig): void {
    localStorage.setItem('passgen-storage-config', JSON.stringify(config));
  }

  getMasterPasswordHash(): string | null {
    return localStorage.getItem('passgen-master-hash');
  }

  setMasterPasswordHash(hash: string): void {
    localStorage.setItem('passgen-master-hash', hash);
  }

  clear(): void {
    localStorage.removeItem('passgen-storage-config');
    localStorage.removeItem('passgen-master-hash');
    // Remove both legacy and current keys just in case
    localStorage.removeItem('passgen-onboarding-complete');
    localStorage.removeItem('passgen-onboarding-completed');
    localStorage.removeItem('passgen-premium');
  }

  getGoogleDriveTokens(): any {
    const config = this.getStorageConfig();
    return config?.googleDrive?.tokens;
  }

  setGoogleDriveTokens(tokens: any): void {
    const config = this.getStorageConfig();
    if (config && config.googleDrive) {
      config.googleDrive.tokens = tokens;
      this.setStorageConfig(config);
    }
  }
}
