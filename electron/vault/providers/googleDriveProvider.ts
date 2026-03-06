import { google } from 'googleapis'
import { Readable } from 'stream'
import type { GoogleDriveProviderConfig, ProviderVersion } from '../types'
import type { StorageProvider, VaultUploadMeta, VaultDownloadMeta, ProviderUploadResult } from './storageProvider'

const VAULT_BASENAME = 'passgen-vault'

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export class GoogleDriveProvider implements StorageProvider {
  id: 'google-drive' = 'google-drive'
  name = 'Google Drive'
  type: 'cloud' = 'cloud'

  private oauth2Client: any
  private drive: any
  private config: GoogleDriveProviderConfig
  private onTokensUpdated?: (tokens: any) => void

  constructor(config: GoogleDriveProviderConfig, oauthConfig: GoogleOAuthConfig, onTokensUpdated?: (tokens: any) => void) {
    this.config = config
    this.onTokensUpdated = onTokensUpdated
    this.oauth2Client = new google.auth.OAuth2(oauthConfig.clientId, oauthConfig.clientSecret, oauthConfig.redirectUri)
    if (config.tokens) {
      this.oauth2Client.setCredentials(config.tokens)
    }
    this.oauth2Client.on('tokens', (tokens: any) => {
      if (!tokens) return
      const merged = { ...this.oauth2Client.credentials, ...tokens }
      this.oauth2Client.setCredentials(merged)
      if (this.onTokensUpdated) {
        this.onTokensUpdated(merged)
      }
    })
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client })
  }

  isConfigured(): boolean {
    return !!this.config.tokens
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Google Drive is not connected' }
    }
    try {
      await this.drive.files.list({ pageSize: 1, fields: 'files(id)' })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  private buildName(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `${VAULT_BASENAME}-${stamp}.pgvault`
  }

  private async listVaultFiles(): Promise<any[]> {
    console.log('[DRIVE-DEBUG] Searching for vault files in space: drive')
    try {
      const response = await this.drive.files.list({
        q: "name contains 'passgen' and trashed = false",
        fields: 'files(id, name, createdTime, modifiedTime, appProperties, size)',
        spaces: 'drive',
        orderBy: 'modifiedTime desc'
      })
      const files = response.data.files || []
      console.log(`[DRIVE-DEBUG] Found ${files.length} files matching query`)
      files.forEach((f: any) => {
        console.log(`[DRIVE-DEBUG] file: ${f.name} (id: ${f.id})`)
      })
      return files
    } catch (error) {
      console.error('[DRIVE-DEBUG] Error listing files:', error)
      throw error
    }
  }

  async upload(data: Buffer, meta: VaultUploadMeta): Promise<ProviderUploadResult> {
    const name = this.buildName()
    const response = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: meta.contentType,
        appProperties: {
          passgenVault: '1',
          createdAt: new Date().toISOString()
        }
      },
      media: {
        mimeType: meta.contentType,
        body: Readable.from(data)
      },
      fields: 'id'
    })

    await this.trimVersions(meta.retainCount)

    return { versionId: response.data.id || name }
  }

  async download(meta?: VaultDownloadMeta): Promise<Buffer> {
    const fileId = meta?.versionId || await this.getLatestFileId()
    if (!fileId) throw new Error('No vault versions found in Google Drive')

    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )
    return Buffer.from(response.data as ArrayBuffer)
  }

  async listVersions(): Promise<ProviderVersion[]> {
    const files = await this.listVaultFiles()
    return files.map((file: any) => ({
      id: file.id,
      name: file.name,
      createdAt: file.modifiedTime || file.createdTime || new Date().toISOString()
    }))
  }

  async restoreVersion(versionId: string): Promise<Buffer> {
    return this.download({ versionId })
  }

  private async getLatestFileId(): Promise<string | undefined> {
    const files = await this.listVaultFiles()
    return files[0]?.id
  }

  private async trimVersions(retainCount: number): Promise<void> {
    const keep = Math.max(1, retainCount || 1)
    const files = await this.listVaultFiles()
    const toDelete = files.slice(keep)
    for (const file of toDelete) {
      try {
        await this.drive.files.delete({ fileId: file.id })
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
