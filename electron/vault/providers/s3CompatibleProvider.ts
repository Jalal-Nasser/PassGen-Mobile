import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { HttpRequest } from '@smithy/protocol-http'
import { Sha256 } from '@aws-crypto/sha256-js'
import type { S3CompatibleProviderConfig, ProviderVersion } from '../types'
import type { StorageProvider, VaultUploadMeta, VaultDownloadMeta, ProviderUploadResult } from './storageProvider'

const VAULT_BASENAME = 'passgen-vault'

export class S3CompatibleProvider implements StorageProvider {
  id: 's3-compatible' = 's3-compatible'
  name = 'S3-Compatible Storage'
  type: 'cloud' = 'cloud'

  private config: S3CompatibleProviderConfig

  constructor(config: S3CompatibleProviderConfig) {
    this.config = config
  }

  isConfigured(): boolean {
    return !!(this.config?.accessKeyId && this.config?.secretAccessKey && this.config?.region && this.config?.bucket)
  }

  validateConfig(): { ok: boolean; error?: string } {
    if (!this.config.accessKeyId || !this.config.secretAccessKey) {
      return { ok: false, error: 'Missing access keys' }
    }
    if (!this.config.region) {
      return { ok: false, error: 'Missing region' }
    }
    if (!this.config.bucket) {
      return { ok: false, error: 'Missing bucket name' }
    }
    return { ok: true }
  }

  private getClient(): S3Client {
    return new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      },
      endpoint: this.config.endpoint || undefined,
      forcePathStyle: !!this.config.endpoint
    })
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const valid = this.validateConfig()
    if (!valid.ok) return valid
    try {
      const client = this.getClient()
      const key = `${this.getPrefix()}passgen-verify-${Date.now()}.txt`
      const body = Buffer.from(`passgen-verify:${new Date().toISOString()}`)
      await client.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: 'text/plain'
      }))

      await client.send(new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      }))

      await client.send(new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      }))
      return { ok: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  private getPrefix(): string {
    const prefix = (this.config.pathPrefix || '').trim()
    if (!prefix) return ''
    return prefix.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
  }

  private buildKey(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `${this.getPrefix()}${VAULT_BASENAME}-${stamp}.pgvault`
  }

  private async listObjects(): Promise<Array<{ key: string; lastModified?: Date }>> {
    const client = this.getClient()
    const prefix = `${this.getPrefix()}${VAULT_BASENAME}-`
    const response = await client.send(new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: prefix
    }))
    const contents = response.Contents || []
    return contents
      .filter(obj => !!obj.Key)
      .map(obj => ({ key: obj.Key as string, lastModified: obj.LastModified }))
      .sort((a, b) => (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0))
  }

  async upload(data: Buffer, meta: VaultUploadMeta): Promise<ProviderUploadResult> {
    const key = this.buildKey()
    const client = this.getClient()
    await client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: data,
      ContentType: meta.contentType,
      Metadata: {
        passgenVault: '1',
        createdAt: new Date().toISOString()
      }
    }))

    await this.trimVersions(meta.retainCount)

    return { versionId: key }
  }

  async download(meta?: VaultDownloadMeta): Promise<Buffer> {
    const client = this.getClient()
    const key = meta?.versionId || await this.getLatestKey()
    if (!key) throw new Error('No vault versions found in bucket')

    const response = await client.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key
    }))
    return await streamToBuffer(response.Body)
  }

  async listVersions(): Promise<ProviderVersion[]> {
    const objects = await this.listObjects()
    return objects.map(obj => ({
      id: obj.key,
      name: obj.key.split('/').pop() || obj.key,
      createdAt: obj.lastModified ? obj.lastModified.toISOString() : new Date().toISOString()
    }))
  }

  async restoreVersion(versionId: string): Promise<Buffer> {
    return this.download({ versionId })
  }

  private async getLatestKey(): Promise<string | undefined> {
    const objects = await this.listObjects()
    return objects[0]?.key
  }

  private async trimVersions(retainCount: number): Promise<void> {
    const keep = Math.max(1, retainCount || 1)
    const objects = await this.listObjects()
    const toDelete = objects.slice(keep)
    if (!toDelete.length) return

    const client = this.getClient()
    await client.send(new DeleteObjectsCommand({
      Bucket: this.config.bucket,
      Delete: {
        Objects: toDelete.map(obj => ({ Key: obj.key })),
        Quiet: true
      }
    }))
  }

  async createSignedRequest(key: string): Promise<HttpRequest> {
    const { SignatureV4 } = await import('@smithy/signature-v4')
    const endpoint = this.config.endpoint
      ? new URL(this.config.endpoint)
      : new URL(`https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`)

    const pathStyle = !!this.config.endpoint
    const request = new HttpRequest({
      protocol: endpoint.protocol,
      hostname: endpoint.hostname,
      method: 'PUT',
      path: pathStyle ? `/${this.config.bucket}/${key}` : `/${key}`,
      headers: {
        host: endpoint.hostname
      }
    })

    const signer = new SignatureV4({
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      },
      service: 's3',
      region: this.config.region,
      sha256: Sha256
    })

    return await signer.sign(request)
  }
}

async function streamToBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    body.on('data', (chunk: Buffer) => chunks.push(chunk))
    body.on('end', () => resolve(Buffer.concat(chunks)))
    body.on('error', (err: Error) => reject(err))
  })
}
