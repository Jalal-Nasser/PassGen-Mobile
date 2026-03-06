import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseStorageProviderConfig, ProviderVersion } from '../types'
import type { StorageProvider, VaultUploadMeta, VaultDownloadMeta, ProviderUploadResult } from './storageProvider'

const VAULT_BASENAME = 'vault'

export class SupabaseStorageProvider implements StorageProvider {
  id: 'supabase' = 'supabase'
  name = 'Supabase Storage'
  type: 'cloud' = 'cloud'

  private config: SupabaseStorageProviderConfig
  private client: SupabaseClient

  constructor(config: SupabaseStorageProviderConfig) {
    this.config = config
    this.client = createClient(config.projectUrl, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  }

  isConfigured(): boolean {
    return !!(this.config?.projectUrl && this.config?.anonKey && this.config?.bucket)
  }

  private validateConfig(): { ok: boolean; error?: string } {
    if (!this.config.projectUrl) return { ok: false, error: 'Missing project URL' }
    if (!this.config.anonKey) return { ok: false, error: 'Missing anon key' }
    if (!this.config.bucket) return { ok: false, error: 'Missing bucket name' }
    return { ok: true }
  }

  private getPrefix(): string {
    const raw = (this.config.pathPrefix || '').trim()
    if (!raw) return ''
    return raw.replace(/^\/+/, '').replace(/\/+$/, '')
  }

  private buildKey(): string {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const prefix = this.getPrefix()
    const name = `${VAULT_BASENAME}-${stamp}.bin`
    return prefix ? `${prefix}/${name}` : name
  }

  private async listObjects(): Promise<Array<{ name: string; path: string; createdAt?: string }>> {
    const prefix = this.getPrefix()
    const { data, error } = await this.client.storage
      .from(this.config.bucket)
      .list(prefix, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      throw new Error(error.message)
    }

    const list = data || []
    return list
      .filter(item => item.name && item.name.startsWith(`${VAULT_BASENAME}-`))
      .map(item => ({
        name: item.name,
        path: prefix ? `${prefix}/${item.name}` : item.name,
        createdAt: item.created_at || item.updated_at || undefined
      }))
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const valid = this.validateConfig()
    if (!valid.ok) return valid
    const key = `${this.getPrefix() ? `${this.getPrefix()}/` : ''}passgen-verify-${Date.now()}.txt`
    try {
      const upload = await this.client.storage
        .from(this.config.bucket)
        .upload(key, Buffer.from(`passgen-verify:${new Date().toISOString()}`), {
          contentType: 'text/plain',
          upsert: true
        })
      if (upload.error) throw new Error(upload.error.message)

      const download = await this.client.storage.from(this.config.bucket).download(key)
      if (download.error) throw new Error(download.error.message)

      await this.client.storage.from(this.config.bucket).remove([key])
      return { ok: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  async upload(data: Buffer, meta: VaultUploadMeta): Promise<ProviderUploadResult> {
    const key = this.buildKey()
    const response = await this.client.storage
      .from(this.config.bucket)
      .upload(key, data, {
        contentType: meta.contentType,
        upsert: true
      })
    if (response.error) {
      throw new Error(response.error.message)
    }

    await this.trimVersions(meta.retainCount)
    return { versionId: key }
  }

  async download(meta?: VaultDownloadMeta): Promise<Buffer> {
    const key = meta?.versionId || await this.getLatestKey()
    if (!key) {
      throw new Error('No vault versions found in Supabase Storage')
    }
    const response = await this.client.storage.from(this.config.bucket).download(key)
    if (response.error || !response.data) {
      throw new Error(response.error?.message || 'Failed to download vault from Supabase')
    }
    const bytes = await response.data.arrayBuffer()
    return Buffer.from(bytes)
  }

  async listVersions(): Promise<ProviderVersion[]> {
    const objects = await this.listObjects()
    return objects.map(item => ({
      id: item.path,
      name: item.name,
      createdAt: item.createdAt || new Date().toISOString()
    }))
  }

  async restoreVersion(versionId: string): Promise<Buffer> {
    return this.download({ versionId })
  }

  private async getLatestKey(): Promise<string | undefined> {
    const objects = await this.listObjects()
    return objects[0]?.path
  }

  private async trimVersions(retainCount: number): Promise<void> {
    const keep = Math.max(1, retainCount || 1)
    const objects = await this.listObjects()
    const toDelete = objects.slice(keep)
    if (!toDelete.length) return
    await this.client.storage.from(this.config.bucket).remove(toDelete.map(item => item.path))
  }
}
