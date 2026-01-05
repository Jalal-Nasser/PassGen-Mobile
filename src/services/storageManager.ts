import type { StorageConfig, ProviderId } from './storageTypes'
import { ConfigStore } from './configStore'
import type { PasswordEntry } from './encryption'

const PROVIDER_LABELS: Record<ProviderId, string> = {
  local: 'Local Storage',
  'google-drive': 'Google Drive',
  's3-compatible': 'S3-Compatible Storage',
  dropbox: 'Dropbox (Coming soon)',
  onedrive: 'OneDrive (Coming soon)'
}

export class StorageManager {
  private currentConfig: StorageConfig | null = null
  private providerLabel = PROVIDER_LABELS.local

  async initializeEncryption(masterPassword: string): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.vaultUnlock) {
      throw new Error('Vault backend is not available')
    }

    await api.vaultUnlock(masterPassword)
    await this.migrateLegacyVault(masterPassword)
    await this.refreshProviderStatus()
  }

  async initializeEncryptionWithPasskey(installId: string): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.vaultUnlockWithPasskey) {
      throw new Error('Vault backend is not available')
    }
    await api.vaultUnlockWithPasskey(installId)
    await this.refreshProviderStatus()
  }

  async storePasskeyKey(installId: string): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.passkeyStoreKey) {
      throw new Error('Vault backend is not available')
    }
    await api.passkeyStoreKey(installId)
  }

  async initializeStorage(config: StorageConfig): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.storageConfigure) {
      throw new Error('Vault backend is not available')
    }

    this.currentConfig = config
    try {
      const store = new ConfigStore()
      store.setStorageConfig(config)
    } catch (error) {
      console.warn('Failed to persist storage config locally:', error)
    }
    await api.storageConfigure(config)
    await this.refreshProviderStatus()
  }

  async savePasswordEntry(entry: PasswordEntry): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.vaultAdd) throw new Error('Vault backend is not available')
    await api.vaultAdd(entry)
  }

  async updatePasswordEntry(entry: PasswordEntry): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.vaultUpdate) throw new Error('Vault backend is not available')
    await api.vaultUpdate(entry)
  }

  async getAllPasswordEntries(): Promise<PasswordEntry[]> {
    const api = (window as any).electronAPI
    if (!api?.vaultList) throw new Error('Vault backend is not available')
    return await api.vaultList()
  }

  async repairVault(): Promise<{ total: number; kept: number; migrated: number; removed: number }> {
    const api = (window as any).electronAPI
    if (!api?.vaultRepair) throw new Error('Vault backend is not available')
    return await api.vaultRepair()
  }

  async exportVault(): Promise<string> {
    const api = (window as any).electronAPI
    if (!api?.vaultExportEncrypted) throw new Error('Vault backend is not available')
    return await api.vaultExportEncrypted()
  }

  async importVault(data: string): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.vaultImportEncrypted) throw new Error('Vault backend is not available')
    await api.vaultImportEncrypted(data)
  }

  async getVaultStatus(): Promise<{ hasVault: boolean; vaultPath: string; activeProviderId: ProviderId }> {
    const api = (window as any).electronAPI
    if (!api?.vaultStatus) throw new Error('Vault backend is not available')
    return await api.vaultStatus()
  }

  async refreshProviderStatus(): Promise<string> {
    const api = (window as any).electronAPI
    if (!api?.storageProviderStatus) return this.providerLabel
    const status = await api.storageProviderStatus()
    const label = PROVIDER_LABELS[status.activeProviderId as ProviderId] || status.activeProviderId
    this.providerLabel = label
    return label
  }

  getCurrentProvider(): string {
    return this.providerLabel
  }

  getStorageConfig(): StorageConfig | null {
    return this.currentConfig
  }

  resetApp(): void {
    try {
      Object.keys(localStorage)
        .filter(k => k.toLowerCase().startsWith('passgen-'))
        .forEach(k => localStorage.removeItem(k))

      this.currentConfig = null
      this.providerLabel = PROVIDER_LABELS.local
    } catch (e) {
      console.error('Failed to reset app state:', e)
    }
  }

  private async migrateLegacyVault(masterPassword: string): Promise<void> {
    const api = (window as any).electronAPI
    if (!api?.vaultImportLegacy) return

    const raw = localStorage.getItem('passgen-vault-data')
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      await api.vaultImportLegacy(parsed, masterPassword)
      localStorage.removeItem('passgen-vault-data')
    } catch (error) {
      console.warn('Legacy vault migration failed:', error)
    }
  }
}
