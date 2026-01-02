export type ProviderId = 'local' | 'google-drive' | 's3-compatible' | 'dropbox' | 'onedrive'

export interface VaultEntry {
  id: string
  name: string
  password: string
  username?: string
  url?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface VaultMeta {
  createdAt: string
  updatedAt: string
  vaultVersion: number
}

export interface LocalProviderConfig {
  vaultPath?: string
  backupsEnabled: boolean
  keepLast: number
}

export interface GoogleDriveProviderConfig {
  tokens?: any
  accountEmail?: string
}

export interface S3CompatibleProviderConfig {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucket: string
  endpoint?: string
  pathPrefix?: string
}

export interface ProviderConfigs {
  activeProviderId?: ProviderId
  local?: LocalProviderConfig
  googleDrive?: GoogleDriveProviderConfig
  s3Compatible?: S3CompatibleProviderConfig
  dropbox?: Record<string, never>
  onedrive?: Record<string, never>
}

export interface AppAccountSession {
  accessToken?: string
  accessExpiresAt?: string
  refreshToken?: string
  refreshExpiresAt?: string
  deviceId?: string
  email?: string
  userId?: string
  plan?: string
  isPremium?: boolean
  expiresAt?: string | null
}

export interface VaultPayload {
  vaultItems: VaultEntry[]
  providerConfigs: ProviderConfigs
  appAccount?: AppAccountSession
  meta: VaultMeta
}

export type KdfAlg = 'argon2id' | 'pbkdf2-sha256'

export interface KdfParams {
  alg: KdfAlg
  params: {
    keyLength: number
    timeCost?: number
    memoryCost?: number
    parallelism?: number
    iterations?: number
  }
}

export type CipherAlg = 'xchacha20-poly1305' | 'aes-256-gcm'

export interface VaultFileHeader {
  magic: string
  version: number
  kdf: KdfParams
  salt: string
  nonce: string
  cipher: CipherAlg
  tag?: string
}

export interface VaultFile {
  header: VaultFileHeader
  ciphertext: string
}

export interface ProviderVersion {
  id: string
  name: string
  createdAt: string
}
