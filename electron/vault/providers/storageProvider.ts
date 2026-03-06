import type { ProviderId, ProviderVersion } from '../types'

export interface VaultUploadMeta {
  baseName: string
  contentType: string
  retainCount: number
}

export interface VaultDownloadMeta {
  versionId?: string
}

export interface ProviderUploadResult {
  versionId: string
  location?: string
}

export interface StorageProvider {
  id: ProviderId
  name: string
  type: 'local' | 'cloud'
  isConfigured(): boolean
  testConnection(): Promise<{ ok: boolean; error?: string }>
  upload(data: Buffer, meta: VaultUploadMeta): Promise<ProviderUploadResult>
  download(meta?: VaultDownloadMeta): Promise<Buffer>
  listVersions(): Promise<ProviderVersion[]>
  restoreVersion(versionId: string): Promise<Buffer>
}
