// Simple localStorage-based config store
// No Node.js dependencies - safe for renderer process
import CryptoJS from 'crypto-js'
import type { ProviderId, S3CompatibleConfig, SupabaseStorageConfig } from './storageTypes'

export interface StorageConfig {
  provider: ProviderId;
  local?: {
    vaultFolder?: string;
    backupsEnabled?: boolean;
    keepLast?: number;
  };
  googleDrive?: {
    tokens?: any;
    accountEmail?: string;
  };
  s3Compatible?: S3CompatibleConfig;
  supabase?: SupabaseStorageConfig;
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
    // Desktop-only activation secret. iOS/Appflow must never receive this value.
    // Resolution order:
    //   1. Runtime window override, set by Electron main before renderer loads.
    //   2. VITE_SELLER_SECRET, defined only for non-iOS Vite builds.
    //   3. Hard failure. There is no hardcoded fallback.
    const secret =
      (window as any)?.PASSGEN_SELLER_SECRET ||
      (import.meta as any)?.env?.VITE_SELLER_SECRET ||
      ''

    if (!secret) {
      throw new Error(
        'Desktop activation secret is missing. Set VITE_SELLER_SECRET for desktop builds only.'
      )
    }

    return secret
  }

  // Dev-only helper to inspect the effective desktop secret without logging it.
  getSellerSecretForDebug(): string {
    return this.getSellerSecret()
  }

  computeActivationCode(email?: string): string {
    const installId = this.getInstallId()
    const secret = this.getSellerSecret()
    const data = `${installId}|${(email || this.getUserEmail() || '').trim().toLowerCase()}|${secret}`
    const digest = CryptoJS.SHA256(data).toString()
    return digest.substring(0, 10).toUpperCase()
  }

  verifyActivationCode(code: string, email?: string): boolean {
    return this.computeActivationCode(email) === code.trim().toUpperCase()
  }
  isPremium(): boolean {
    const active = localStorage.getItem('passgen-premium') === 'true'
    if (!active) return false

    const expiry = this.getPremiumExpiry()
    if (expiry && Date.now() > expiry.getTime()) {
      this.setPremium(false)
      return false
    }
    return true
  }

  setPremium(value: boolean, expiresAt?: Date): void {
    localStorage.setItem('passgen-premium', value ? 'true' : 'false')
    if (value) {
      const expiry = expiresAt || this.computeDefaultExpiry()
      localStorage.setItem('passgen-premium-expiry', expiry.toISOString())
    } else {
      localStorage.removeItem('passgen-premium-expiry')
    }
    window.dispatchEvent(new Event('premium-changed'))
  }

  getPremiumExpiry(): Date | null {
    const raw = localStorage.getItem('passgen-premium-expiry')
    if (!raw) return null
    const parsed = new Date(raw)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  private computeDefaultExpiry(): Date {
    const now = new Date()
    now.setMonth(now.getMonth() + 6)
    return now
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

  getPasskeyCredential(): { credentialId: string; publicKey: string } | null {
    const data = localStorage.getItem('passgen-passkey-credential');
    return data ? JSON.parse(data) : null;
  }

  setPasskeyCredential(credentialId: string, publicKey: string): void {
    localStorage.setItem('passgen-passkey-credential', JSON.stringify({ credentialId, publicKey }));
  }

  clearPasskeyCredential(): void {
    localStorage.removeItem('passgen-passkey-credential');
  }

  clear(): void {
    localStorage.removeItem('passgen-storage-config');
    localStorage.removeItem('passgen-master-hash');
    localStorage.removeItem('passgen-passkey-credential');
    // Remove both legacy and current keys just in case
    localStorage.removeItem('passgen-onboarding-complete');
    localStorage.removeItem('passgen-onboarding-completed');
    localStorage.removeItem('passgen-premium');
    localStorage.removeItem('passgen-premium-expiry');
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

  private getDevSecretUsageKey(dateKey: string): string {
    return `passgen-dev-secret-usage-${dateKey}`
  }

  getDevSecretUsage(dateKey: string): number {
    const raw = localStorage.getItem(this.getDevSecretUsageKey(dateKey))
    const parsed = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(parsed) ? parsed : 0
  }

  setDevSecretUsage(dateKey: string, count: number): void {
    localStorage.setItem(this.getDevSecretUsageKey(dateKey), String(count))
  }

  incrementDevSecretUsage(dateKey: string): number {
    const next = this.getDevSecretUsage(dateKey) + 1
    this.setDevSecretUsage(dateKey, next)
    return next
  }
}
