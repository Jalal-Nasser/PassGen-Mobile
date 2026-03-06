import type { StorageProvider, VaultUploadMeta, VaultDownloadMeta, ProviderUploadResult } from './storageProvider'
import type { ProviderVersion } from '../types'

export class DropboxProvider implements StorageProvider {
  id: 'dropbox' = 'dropbox'
  name = 'Dropbox'
  type: 'cloud' = 'cloud'

  isConfigured(): boolean {
    return false
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Dropbox integration is coming soon' }
  }

  async upload(_data: Buffer, _meta: VaultUploadMeta): Promise<ProviderUploadResult> {
    throw new Error('Dropbox integration is coming soon')
  }

  async download(_meta?: VaultDownloadMeta): Promise<Buffer> {
    throw new Error('Dropbox integration is coming soon')
  }

  async listVersions(): Promise<ProviderVersion[]> {
    return []
  }

  async restoreVersion(_versionId: string): Promise<Buffer> {
    throw new Error('Dropbox integration is coming soon')
  }
}
