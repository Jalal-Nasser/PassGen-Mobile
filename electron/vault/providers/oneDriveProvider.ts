import type { StorageProvider, VaultUploadMeta, VaultDownloadMeta, ProviderUploadResult } from './storageProvider'
import type { ProviderVersion, OneDriveProviderConfig, OneDriveTokens } from '../types'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const VAULT_PREFIX = 'passgen-vault-'

export interface OneDriveOAuthConfig {
  clientId: string
  tenant: string
  scopes: string[]
}

type GraphDriveItem = {
  id?: string
  name?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
}

function normalizeTokens(payload: any): OneDriveTokens {
  const accessToken = payload.access_token || payload.accessToken || ''
  const refreshToken = payload.refresh_token || payload.refreshToken
  const expiresIn = Number(payload.expires_in || payload.expiresIn || 0)
  const expiresAt = payload.expires_at || payload.expiresAt || (expiresIn ? Date.now() + expiresIn * 1000 : undefined)
  return {
    accessToken,
    refreshToken,
    expiresAt,
    scope: payload.scope,
    tokenType: payload.token_type || payload.tokenType
  }
}

export class OneDriveProvider implements StorageProvider {
  id: 'onedrive' = 'onedrive'
  name = 'OneDrive'
  type: 'cloud' = 'cloud'

  private config: OneDriveProviderConfig
  private oauth: OneDriveOAuthConfig
  private onTokensUpdated?: (tokens: OneDriveTokens) => void

  constructor(config: OneDriveProviderConfig, oauth: OneDriveOAuthConfig, onTokensUpdated?: (tokens: OneDriveTokens) => void) {
    this.config = config
    this.oauth = oauth
    this.onTokensUpdated = onTokensUpdated
  }

  isConfigured(): boolean {
    return !!this.config.tokens?.accessToken
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'OneDrive is not connected' }
    }
    try {
      await this.graphJson(`${GRAPH_BASE}/me/drive`)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  private buildName(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `${VAULT_PREFIX}${stamp}.pgvault`
  }

  private async getAccessToken(): Promise<string> {
    const tokens = this.config.tokens
    if (!tokens?.accessToken) {
      throw new Error('OneDrive is not connected')
    }
    if (tokens.expiresAt && Date.now() < tokens.expiresAt - 60000) {
      return tokens.accessToken
    }
    if (!tokens.refreshToken) {
      return tokens.accessToken
    }
    await this.refreshTokens()
    if (!this.config.tokens?.accessToken) {
      throw new Error('OneDrive access token refresh failed')
    }
    return this.config.tokens.accessToken
  }

  private async refreshTokens(): Promise<void> {
    const refreshToken = this.config.tokens?.refreshToken
    if (!refreshToken) return
    const body = new URLSearchParams()
    body.set('client_id', this.oauth.clientId)
    body.set('grant_type', 'refresh_token')
    body.set('refresh_token', refreshToken)
    body.set('scope', this.oauth.scopes.join(' '))
    const response = await fetch(`https://login.microsoftonline.com/${this.oauth.tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(text || `OneDrive token refresh failed (${response.status})`)
    }
    const data = JSON.parse(text)
    const tokens = normalizeTokens(data)
    this.config.tokens = tokens
    if (this.onTokensUpdated) {
      this.onTokensUpdated(tokens)
    }
  }

  private async graphRequest(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken()
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers })
  }

  private async graphJson(url: string, init?: RequestInit): Promise<any> {
    const response = await this.graphRequest(url, init)
    const text = await response.text()
    if (!response.ok) {
      throw new Error(text || `OneDrive request failed (${response.status})`)
    }
    return text ? JSON.parse(text) : null
  }

  private async listVaultFiles(): Promise<GraphDriveItem[]> {
    const data = await this.graphJson(`${GRAPH_BASE}/me/drive/special/approot/children?$select=id,name,createdDateTime,lastModifiedDateTime`)
    const items: GraphDriveItem[] = Array.isArray(data?.value) ? data.value : []
    return items
      .filter(item => (item.name || '').startsWith(VAULT_PREFIX))
      .sort((a, b) => {
        const aTime = Date.parse(a.lastModifiedDateTime || a.createdDateTime || '') || 0
        const bTime = Date.parse(b.lastModifiedDateTime || b.createdDateTime || '') || 0
        return bTime - aTime
      })
  }

  async upload(data: Buffer, meta: VaultUploadMeta): Promise<ProviderUploadResult> {
    const name = this.buildName()
    const url = `${GRAPH_BASE}/me/drive/special/approot:/${encodeURIComponent(name)}:/content`
    const response = await this.graphRequest(url, {
      method: 'PUT',
      headers: { 'Content-Type': meta.contentType },
      body: data
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(text || `OneDrive upload failed (${response.status})`)
    }
    let versionId = name
    try {
      const info = JSON.parse(text)
      if (info?.id) versionId = info.id
    } catch {
      // ignore parse errors
    }
    await this.trimVersions(meta.retainCount)
    return { versionId }
  }

  async download(meta?: VaultDownloadMeta): Promise<Buffer> {
    const fileId = meta?.versionId || await this.getLatestFileId()
    if (!fileId) throw new Error('No vault versions found in OneDrive')
    const response = await this.graphRequest(`${GRAPH_BASE}/me/drive/items/${fileId}/content`, {
      method: 'GET'
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `OneDrive download failed (${response.status})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async listVersions(): Promise<ProviderVersion[]> {
    const files = await this.listVaultFiles()
    return files.map(file => ({
      id: file.id || file.name || '',
      name: file.name || file.id || '',
      createdAt: file.lastModifiedDateTime || file.createdDateTime || new Date().toISOString()
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
      if (!file.id) continue
      try {
        await this.graphRequest(`${GRAPH_BASE}/me/drive/items/${file.id}`, { method: 'DELETE' })
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
