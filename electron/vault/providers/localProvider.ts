import fs from 'fs'
import path from 'path'
import type { LocalProviderConfig, ProviderVersion } from '../types'
import type { StorageProvider, VaultUploadMeta, VaultDownloadMeta, ProviderUploadResult } from './storageProvider'

export class LocalProvider implements StorageProvider {
  id: 'local' = 'local'
  name = 'Local Storage'
  type: 'local' = 'local'

  private config: LocalProviderConfig

  constructor(config: LocalProviderConfig) {
    this.config = config
  }

  isConfigured(): boolean {
    return !!this.config.vaultPath
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.config.vaultPath) return { ok: false, error: 'Vault path is not configured' }
    try {
      await fs.promises.mkdir(path.dirname(this.config.vaultPath), { recursive: true })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  private getVaultPath(): string {
    if (!this.config.vaultPath) {
      throw new Error('Vault path is not configured')
    }
    return this.config.vaultPath
  }

  private getBackupDir(): string {
    const vaultPath = this.getVaultPath()
    return path.join(path.dirname(vaultPath), 'VaultBackups')
  }

  private async createBackupIfNeeded(): Promise<void> {
    if (!this.config.backupsEnabled) return

    const vaultPath = this.getVaultPath()
    if (!fs.existsSync(vaultPath)) return

    const backupDir = this.getBackupDir()
    await fs.promises.mkdir(backupDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `passgen-vault-${stamp}.pgvault`)
    await fs.promises.copyFile(vaultPath, backupPath)
  }

  private async trimBackups(): Promise<void> {
    if (!this.config.backupsEnabled) return
    const keepLast = Math.max(1, this.config.keepLast || 1)
    const backupDir = this.getBackupDir()
    if (!fs.existsSync(backupDir)) return

    const entries = await fs.promises.readdir(backupDir)
    const files = entries
      .filter(name => name.startsWith('passgen-vault-') && name.endsWith('.pgvault'))
      .map(name => ({
        name,
        fullPath: path.join(backupDir, name),
        stat: fs.statSync(path.join(backupDir, name))
      }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)

    const toDelete = files.slice(keepLast)
    for (const file of toDelete) {
      try {
        await fs.promises.unlink(file.fullPath)
      } catch {
        // ignore cleanup errors
      }
    }
  }

  async upload(data: Buffer, _meta: VaultUploadMeta): Promise<ProviderUploadResult> {
    const vaultPath = this.getVaultPath()
    await fs.promises.mkdir(path.dirname(vaultPath), { recursive: true })
    await this.createBackupIfNeeded()
    await fs.promises.writeFile(vaultPath, data)
    await this.trimBackups()
    return { versionId: path.basename(vaultPath) }
  }

  async download(_meta?: VaultDownloadMeta): Promise<Buffer> {
    const vaultPath = this.getVaultPath()
    return await fs.promises.readFile(vaultPath)
  }

  async listVersions(): Promise<ProviderVersion[]> {
    const backupDir = this.getBackupDir()
    if (!fs.existsSync(backupDir)) return []
    const entries = await fs.promises.readdir(backupDir)
    const files = entries
      .filter(name => name.startsWith('passgen-vault-') && name.endsWith('.pgvault'))
      .map(name => ({
        name,
        fullPath: path.join(backupDir, name),
        stat: fs.statSync(path.join(backupDir, name))
      }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)

    return files.map(file => ({
      id: file.fullPath,
      name: file.name,
      createdAt: file.stat.mtime.toISOString()
    }))
  }

  async restoreVersion(versionId: string): Promise<Buffer> {
    const vaultPath = this.getVaultPath()
    const data = await fs.promises.readFile(versionId)
    await fs.promises.writeFile(vaultPath, data)
    return data
  }
}
