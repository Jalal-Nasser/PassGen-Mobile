import fs from 'fs'
import path from 'path'
import http from 'http'
import { app, shell } from 'electron'
import CryptoJS from 'crypto-js'
import { google } from 'googleapis'
import type {
  ProviderId,
  VaultEntry,
  VaultPayload,
  VaultFile,
  VaultFileHeader,
  GoogleDriveProviderConfig,
  S3CompatibleProviderConfig,
  AppAccountSession
} from './types'
import {
  createNewVaultFile,
  decryptVaultFileWithKey,
  deriveKeyFromHeader,
  encryptVaultPayloadWithKey,
  parseVaultFile,
  serializeVaultFile
} from './crypto'
import { getActiveProviderId, getLocalVaultPath, setActiveProviderId, setLocalVaultPath } from './settingsStore'
import { LocalProvider } from './providers/localProvider'
import { GoogleDriveProvider, type GoogleOAuthConfig } from './providers/googleDriveProvider'
import { S3CompatibleProvider } from './providers/s3CompatibleProvider'
import { DropboxProvider } from './providers/dropboxProvider'
import { OneDriveProvider } from './providers/oneDriveProvider'
import type { StorageProvider } from './providers/storageProvider'

const DEFAULT_BACKUP_COUNT = 10
const DEFAULT_CLOUD_RETENTION = 10
const VAULT_FILE_NAME = 'passgen-vault.pgvault'

export interface StorageConfigInput {
  provider: ProviderId
  local?: {
    vaultFolder?: string
    backupsEnabled?: boolean
    keepLast?: number
  }
  s3Compatible?: S3CompatibleProviderConfig
}

export class VaultRepository {
  private vaultPayload: VaultPayload | null = null
  private vaultHeader: VaultFileHeader | null = null
  private derivedKey: Buffer | null = null
  private pendingConfig: StorageConfigInput | null = null
  private pendingGoogleDrive: GoogleDriveProviderConfig | null = null
  private pendingAppAccount: AppAccountSession | null = null
  private syncedFromCloud = false

  getStatus(): { hasVault: boolean; vaultPath: string; activeProviderId: ProviderId } {
    const vaultPath = this.getVaultPath()
    return {
      hasVault: fs.existsSync(vaultPath),
      vaultPath,
      activeProviderId: getActiveProviderId()
    }
  }

  getProviderStatus(): {
    activeProviderId: ProviderId
    local: { vaultFolder: string; backupsEnabled: boolean; keepLast: number }
    googleDrive: { connected: boolean; email?: string }
    s3Compatible: { configured: boolean }
  } {
    const payload = this.vaultPayload
    const localConfig = payload?.providerConfigs.local
    const vaultFolder = path.dirname(this.getVaultPath())
    return {
      activeProviderId: getActiveProviderId(),
      local: {
        vaultFolder,
        backupsEnabled: localConfig?.backupsEnabled ?? true,
        keepLast: localConfig?.keepLast ?? DEFAULT_BACKUP_COUNT
      },
      googleDrive: {
        connected: !!(payload?.providerConfigs.googleDrive?.tokens || this.pendingGoogleDrive?.tokens),
        email: payload?.providerConfigs.googleDrive?.accountEmail || this.pendingGoogleDrive?.accountEmail
      },
      s3Compatible: {
        configured: !!payload?.providerConfigs.s3Compatible
      }
    }
  }

  async configureStorage(config: StorageConfigInput): Promise<void> {
    setActiveProviderId(config.provider)

    if (config.local?.vaultFolder) {
      const vaultPath = path.join(config.local.vaultFolder, VAULT_FILE_NAME)
      setLocalVaultPath(vaultPath)
    }

    this.pendingConfig = config
    this.syncedFromCloud = false

    if (this.vaultPayload) {
      this.applyConfigToVault(config)
      await this.persistVault()
      this.pendingConfig = null
    }
  }

  getAppAccountSession(): AppAccountSession | null {
    if (this.vaultPayload?.appAccount) return this.vaultPayload.appAccount
    if (this.pendingAppAccount) return this.pendingAppAccount
    return null
  }

  async setAppAccountSession(session: AppAccountSession | null): Promise<void> {
    if (this.vaultPayload) {
      this.vaultPayload.appAccount = session || undefined
      await this.persistVault()
    } else {
      this.pendingAppAccount = session
    }
  }

  async clearAppAccountSession(): Promise<void> {
    if (this.vaultPayload) {
      this.vaultPayload.appAccount = undefined
      await this.persistVault()
    }
    this.pendingAppAccount = null
  }

  async unlock(masterPassword: string): Promise<{ isNew: boolean }> {
    const vaultPath = this.getVaultPath()
    const existed = fs.existsSync(vaultPath)

    if (existed) {
      const raw = await fs.promises.readFile(vaultPath, 'utf8')
      const parsed = parseVaultFile(raw)
      const key = await deriveKeyFromHeader(masterPassword, parsed.header)
      const payload = await decryptVaultFileWithKey(parsed, key)
      this.vaultPayload = payload
      this.vaultHeader = parsed.header
      this.derivedKey = key
    } else {
      const payload = this.buildEmptyPayload()
      this.applyConfigToPayload(payload, this.pendingConfig || { provider: getActiveProviderId() })
      const created = await createNewVaultFile(payload, masterPassword)
      this.vaultPayload = payload
      this.vaultHeader = created.file.header
      this.derivedKey = created.key
      await this.writeLocalVault(created.file)
    }

    if (this.pendingConfig) {
      this.applyConfigToVault(this.pendingConfig)
      await this.persistVault()
      this.pendingConfig = null
    }

    if (this.pendingGoogleDrive) {
      this.setGoogleDriveConfig(this.pendingGoogleDrive)
      await this.persistVault()
      this.pendingGoogleDrive = null
    }

    if (this.pendingAppAccount) {
      this.vaultPayload.appAccount = this.pendingAppAccount
      await this.persistVault()
      this.pendingAppAccount = null
    }

    return { isNew: !existed }
  }

  async listEntries(): Promise<VaultEntry[]> {
    await this.ensureUnlocked()
    await this.syncFromCloudIfNeeded()
    return this.vaultPayload?.vaultItems || []
  }

  async addEntry(entry: VaultEntry): Promise<void> {
    await this.ensureUnlocked()
    this.vaultPayload!.vaultItems.push(entry)
    await this.persistVault()
  }

  async updateEntry(entry: VaultEntry): Promise<void> {
    await this.ensureUnlocked()
    const items = this.vaultPayload!.vaultItems
    const index = items.findIndex(item => item.id === entry.id)
    if (index === -1) {
      throw new Error('Entry not found')
    }
    items[index] = entry
    await this.persistVault()
  }

  async exportEncrypted(): Promise<string> {
    await this.ensureUnlocked()
    const vaultPath = this.getVaultPath()
    return await fs.promises.readFile(vaultPath, 'utf8')
  }

  async importEncrypted(data: string): Promise<void> {
    await this.ensureUnlocked()
    const parsed = parseVaultFile(data)
    const payload = await decryptVaultFileWithKey(parsed, this.derivedKey as Buffer)
    this.vaultPayload = payload
    this.vaultHeader = parsed.header
    await this.writeLocalVault(parsed)
  }

  async importLegacyEntries(entries: Array<{ filename: string; data: string }>, masterPassword: string): Promise<{ imported: number; skipped: number }> {
    await this.ensureUnlocked()

    let imported = 0
    let skipped = 0
    for (const item of entries) {
      try {
        const bytes = CryptoJS.AES.decrypt(item.data, masterPassword)
        const decrypted = bytes.toString(CryptoJS.enc.Utf8)
        if (!decrypted) {
          skipped++
          continue
        }
        const parsed = JSON.parse(decrypted)
        if (!parsed || !parsed.id || !parsed.name) {
          skipped++
          continue
        }
        this.vaultPayload!.vaultItems.push(parsed as VaultEntry)
        imported++
      } catch {
        skipped++
      }
    }

    if (imported) {
      await this.persistVault()
    }

    return { imported, skipped }
  }

  async repairVault(): Promise<{ total: number; kept: number; migrated: number; removed: number }> {
    await this.ensureUnlocked()
    const total = this.vaultPayload?.vaultItems.length || 0
    return { total, kept: total, migrated: 0, removed: 0 }
  }

  async testS3Connection(config: S3CompatibleProviderConfig): Promise<{ ok: boolean; error?: string }> {
    const provider = new S3CompatibleProvider(config)
    return provider.testConnection()
  }

  async getSignedS3Request(config: S3CompatibleProviderConfig, key: string): Promise<Record<string, string>> {
    const provider = new S3CompatibleProvider(config)
    const signed = await provider.createSignedRequest(key)
    return Object.fromEntries(Object.entries(signed.headers || {}).map(([k, v]) => [k, String(v)]))
  }

  async connectGoogleDrive(): Promise<{ email: string; provider: 'google-drive'; token: any }> {
    const oauthBase = this.getGoogleOAuthConfig()
    if (!oauthBase) {
      throw new Error('Google Drive OAuth credentials are not configured')
    }

    const oauthClientId = process.env.PASSGEN_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? ''
    console.log('[OAuth] Using client_id =', oauthClientId.slice(0, 12), '...', oauthClientId.slice(-12))
    const { oauth2Client, code } = await this.startGoogleOAuth(oauthBase)
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()
    const email = userInfo.data.email || 'Google Account'

    const config: GoogleDriveProviderConfig = {
      tokens,
      accountEmail: email
    }

    if (this.vaultPayload) {
      this.setGoogleDriveConfig(config)
      await this.persistVault()
    } else {
      this.pendingGoogleDrive = config
    }

    return { email, provider: 'google-drive', token: tokens }
  }

  async disconnectGoogleDrive(): Promise<void> {
    if (this.vaultPayload) {
      this.vaultPayload.providerConfigs.googleDrive = undefined
      await this.persistVault()
    }
    this.pendingGoogleDrive = null
  }

  private setGoogleDriveConfig(config: GoogleDriveProviderConfig): void {
    if (!this.vaultPayload) return
    this.vaultPayload.providerConfigs.googleDrive = config
  }

  private async syncFromCloudIfNeeded(): Promise<void> {
    if (this.syncedFromCloud) return
    const provider = await this.getActiveProvider()
    if (!provider || provider.id === 'local') {
      this.syncedFromCloud = true
      return
    }

    if (!provider.isConfigured()) {
      this.syncedFromCloud = true
      return
    }

    try {
      const encrypted = await provider.download()
      const raw = encrypted.toString('utf8')
      const parsed = parseVaultFile(raw)
      if (this.vaultHeader && parsed.header.salt !== this.vaultHeader.salt) {
        throw new Error('Vault key mismatch. Please re-enter your master password.')
      }
      const payload = await decryptVaultFileWithKey(parsed, this.derivedKey as Buffer)
      this.vaultPayload = payload
      this.vaultHeader = parsed.header
      await this.writeLocalVault(parsed)
    } finally {
      this.syncedFromCloud = true
    }
  }

  private async getActiveProvider(): Promise<StorageProvider | null> {
    const active = getActiveProviderId()
    switch (active) {
      case 'google-drive': {
        const config = this.vaultPayload?.providerConfigs.googleDrive
        if (!config?.tokens) return null
        const oauthConfig = this.getGoogleOAuthConfig()
        if (!oauthConfig) throw new Error('Google Drive OAuth credentials are not configured')
        return new GoogleDriveProvider(config, oauthConfig)
      }
      case 's3-compatible': {
        const config = this.vaultPayload?.providerConfigs.s3Compatible
        if (!config) return null
        return new S3CompatibleProvider(config)
      }
      case 'dropbox':
        return new DropboxProvider()
      case 'onedrive':
        return new OneDriveProvider()
      default:
        return null
    }
  }

  private buildEmptyPayload(): VaultPayload {
    const now = new Date().toISOString()
    return {
      vaultItems: [],
      providerConfigs: {
        activeProviderId: getActiveProviderId(),
        local: {
          vaultPath: this.getVaultPath(),
          backupsEnabled: true,
          keepLast: DEFAULT_BACKUP_COUNT
        }
      },
      meta: {
        createdAt: now,
        updatedAt: now,
        vaultVersion: 1
      }
    }
  }

  private applyConfigToVault(config: StorageConfigInput): void {
    if (!this.vaultPayload) return
    this.applyConfigToPayload(this.vaultPayload, config)
  }

  private applyConfigToPayload(payload: VaultPayload, config: StorageConfigInput): void {
    const providerConfigs = payload.providerConfigs
    providerConfigs.activeProviderId = config.provider

    if (config.local) {
      providerConfigs.local = {
        vaultPath: this.getVaultPath(),
        backupsEnabled: config.local.backupsEnabled ?? providerConfigs.local?.backupsEnabled ?? true,
        keepLast: config.local.keepLast ?? providerConfigs.local?.keepLast ?? DEFAULT_BACKUP_COUNT
      }
    }

    if (config.s3Compatible) {
      providerConfigs.s3Compatible = config.s3Compatible
    }
  }

  private async persistVault(): Promise<void> {
    await this.ensureUnlocked()
    this.vaultPayload!.meta.updatedAt = new Date().toISOString()

    const file = await encryptVaultPayloadWithKey(this.vaultPayload as VaultPayload, this.vaultHeader as VaultFileHeader, this.derivedKey as Buffer)
    this.vaultHeader = file.header

    await this.writeLocalVault(file)

    const provider = await this.getActiveProvider()
    if (provider && provider.id !== 'local') {
      await provider.upload(Buffer.from(serializeVaultFile(file), 'utf8'), {
        baseName: 'passgen-vault',
        contentType: 'application/octet-stream',
        retainCount: DEFAULT_CLOUD_RETENTION
      })
    }
  }

  private async writeLocalVault(file: VaultFile): Promise<void> {
    const localConfig = this.vaultPayload?.providerConfigs.local || {
      vaultPath: this.getVaultPath(),
      backupsEnabled: true,
      keepLast: DEFAULT_BACKUP_COUNT
    }
    const provider = new LocalProvider({
      vaultPath: this.getVaultPath(),
      backupsEnabled: localConfig.backupsEnabled,
      keepLast: localConfig.keepLast
    })

    await provider.upload(Buffer.from(serializeVaultFile(file), 'utf8'), {
      baseName: 'passgen-vault',
      contentType: 'application/octet-stream',
      retainCount: localConfig.keepLast || DEFAULT_BACKUP_COUNT
    })
  }

  private getVaultPath(): string {
    const configured = getLocalVaultPath()
    if (configured) return configured
    return path.join(app.getPath('userData'), 'Vault', VAULT_FILE_NAME)
  }

  private async ensureUnlocked(): Promise<void> {
    if (!this.vaultPayload || !this.vaultHeader || !this.derivedKey) {
      throw new Error('Vault is locked')
    }
  }

  private getGoogleOAuthConfig(): GoogleOAuthConfig | null {
    const clientId = process.env.PASSGEN_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.PASSGEN_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      const missing: string[] = []
      if (!clientId) missing.push('PASSGEN_GOOGLE_CLIENT_ID/GOOGLE_CLIENT_ID')
      if (!clientSecret) missing.push('PASSGEN_GOOGLE_CLIENT_SECRET/GOOGLE_CLIENT_SECRET')
      console.warn(`[OAuth] Missing Google OAuth env vars: ${missing.join(', ')}`)
      return null
    }
    return {
      clientId,
      clientSecret,
      redirectUri: 'http://127.0.0.1'
    }
  }

  private async startGoogleOAuth(oauthConfig: GoogleOAuthConfig): Promise<{ oauth2Client: any; code: string }> {
    const server = http.createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))

    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close()
      throw new Error('Failed to start local OAuth server')
    }

    const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`
    const oauth2Client = new google.auth.OAuth2(oauthConfig.clientId, oauthConfig.clientSecret, redirectUri)

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid'
      ],
      prompt: 'consent'
    })

    const clientIdSource = process.env.PASSGEN_GOOGLE_CLIENT_ID
      ? 'PASSGEN_GOOGLE_CLIENT_ID'
      : 'GOOGLE_CLIENT_ID'
    const rawClientId = process.env.PASSGEN_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? ''
    const safeAuthUrl = (() => {
      try {
        const url = new URL(authUrl)
        const redactKeys = new Set(['client_secret', 'access_token', 'refresh_token', 'id_token', 'code', 'token'])
        for (const key of redactKeys) {
          if (url.searchParams.has(key)) {
            url.searchParams.set(key, 'REDACTED')
          }
        }
        return url.toString()
      } catch {
        return authUrl
      }
    })()
    console.log('[OAuth] client_id source =', clientIdSource)
    console.log('[OAuth] client_id =', rawClientId.slice(0, 12), '...', rawClientId.slice(-12))
    console.log('[OAuth] redirect_uri =', redirectUri)
    console.log('[OAuth] auth_url =', safeAuthUrl)

    const codePromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close()
        reject(new Error('Google Drive authentication timed out'))
      }, 120000)

      server.on('request', (req, res) => {
        try {
          const url = new URL(req.url || '/', redirectUri)
          const code = url.searchParams.get('code')
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<h3>PassGen connected. You can return to the app.</h3>')
            clearTimeout(timeout)
            server.close()
            resolve(code)
          } else {
            res.writeHead(400)
            res.end('Missing code')
          }
        } catch (error) {
          clearTimeout(timeout)
          server.close()
          reject(error)
        }
      })
    })

    console.log(`[OAuth] authUrl=${authUrl}`)
    console.log(`[OAuth] clientIdSource=${clientIdSource} clientIdLen=${rawClientId.length} redirectUri=${redirectUri}`)
    await shell.openExternal(authUrl)
    const code = await codePromise
    return { oauth2Client, code }
  }
}
