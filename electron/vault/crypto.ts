import crypto from 'crypto'
import type { VaultFile, VaultFileHeader, VaultPayload, KdfParams, CipherAlg } from './types'

const MAGIC = 'PASSGENVAULT'
const VERSION = 1
const KEY_LENGTH = 32
const SALT_LENGTH = 16
const AES_GCM_NONCE_LENGTH = 12
const XCHACHA_NONCE_LENGTH = 24
const DEFAULT_PBKDF2_ITER = 310000

let sodiumModule: any | null | undefined
let argon2Module: any | null | undefined
let warnedKdfFallback = false
let warnedCipherFallback = false

function toBase64(buf: Buffer): string {
  return buf.toString('base64')
}

function fromBase64(data: string): Buffer {
  return Buffer.from(data, 'base64')
}

async function loadSodium(): Promise<any | null> {
  if (sodiumModule !== undefined) return sodiumModule
  try {
    const mod = await import('libsodium-wrappers')
    await mod.ready
    sodiumModule = mod
  } catch {
    sodiumModule = null
  }
  return sodiumModule
}

async function loadArgon2(): Promise<any | null> {
  if (argon2Module !== undefined) return argon2Module
  try {
    const mod = await import('argon2')
    argon2Module = mod
  } catch {
    argon2Module = null
  }
  return argon2Module
}

async function getPreferredCipher(): Promise<CipherAlg> {
  const sodium = await loadSodium()
  if (sodium) return 'xchacha20-poly1305'
  if (!warnedCipherFallback) {
    console.warn('[VAULT] libsodium not available, using AES-256-GCM.')
    warnedCipherFallback = true
  }
  return 'aes-256-gcm'
}

export async function getPreferredKdfParams(): Promise<KdfParams> {
  const argon2 = await loadArgon2()
  if (argon2) {
    return {
      alg: 'argon2id',
      params: {
        keyLength: KEY_LENGTH,
        timeCost: 3,
        memoryCost: 65536,
        parallelism: 1
      }
    }
  }

  if (!warnedKdfFallback) {
    console.warn('[VAULT] Argon2 not available, falling back to PBKDF2.')
    warnedKdfFallback = true
  }

  return {
    alg: 'pbkdf2-sha256',
    params: {
      keyLength: KEY_LENGTH,
      iterations: DEFAULT_PBKDF2_ITER
    }
  }
}

export async function deriveKey(masterPassword: string, salt: Buffer, kdf: KdfParams): Promise<Buffer> {
  if (kdf.alg === 'argon2id') {
    const argon2 = await loadArgon2()
    if (!argon2) {
      throw new Error('Argon2id is required to unlock this vault but is not available.')
    }
    const result = await argon2.hash(masterPassword, {
      type: argon2.argon2id,
      salt,
      hashLength: kdf.params.keyLength,
      timeCost: kdf.params.timeCost ?? 3,
      memoryCost: kdf.params.memoryCost ?? 65536,
      parallelism: kdf.params.parallelism ?? 1,
      raw: true
    })
    return Buffer.from(result)
  }

  const iterations = kdf.params.iterations ?? DEFAULT_PBKDF2_ITER
  return await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(masterPassword, salt, iterations, kdf.params.keyLength, 'sha256', (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

function buildHeader(kdf: KdfParams, salt: Buffer, nonce: Buffer, cipher: CipherAlg, tag?: Buffer): VaultFileHeader {
  return {
    magic: MAGIC,
    version: VERSION,
    kdf,
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    cipher,
    tag: tag ? toBase64(tag) : undefined
  }
}

export async function encryptVaultPayload(payload: VaultPayload, masterPassword: string, existingHeader?: VaultFileHeader): Promise<VaultFile> {
  const kdf = existingHeader?.kdf ?? await getPreferredKdfParams()
  const salt = existingHeader ? fromBase64(existingHeader.salt) : crypto.randomBytes(SALT_LENGTH)
  const key = await deriveKey(masterPassword, salt, kdf)
  const cipher = existingHeader?.cipher ?? await getPreferredCipher()
  const header = buildHeader(kdf, salt, Buffer.alloc(0), cipher)
  return encryptVaultPayloadWithKey(payload, header, key)
}

export async function createNewVaultFile(payload: VaultPayload, masterPassword: string): Promise<{ file: VaultFile; key: Buffer }> {
  const kdf = await getPreferredKdfParams()
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = await deriveKey(masterPassword, salt, kdf)
  const cipher = await getPreferredCipher()
  const header = buildHeader(kdf, salt, Buffer.alloc(0), cipher)
  const file = await encryptVaultPayloadWithKey(payload, header, key)
  return { file, key }
}

export async function encryptVaultPayloadWithKey(payload: VaultPayload, header: VaultFileHeader, key: Buffer): Promise<VaultFile> {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')

  if (header.cipher === 'xchacha20-poly1305') {
    const sodium = await loadSodium()
    if (!sodium) {
      throw new Error('libsodium is required to encrypt with xchacha20-poly1305 but is not available.')
    }
    const nonce = crypto.randomBytes(XCHACHA_NONCE_LENGTH)
    const cipherBytes = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      null,
      null,
      nonce,
      key
    )
    return {
      header: buildHeader(header.kdf, fromBase64(header.salt), nonce, 'xchacha20-poly1305'),
      ciphertext: toBase64(Buffer.from(cipherBytes))
    }
  }

  const nonce = crypto.randomBytes(AES_GCM_NONCE_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    header: buildHeader(header.kdf, fromBase64(header.salt), nonce, 'aes-256-gcm', tag),
    ciphertext: toBase64(ciphertext)
  }
}

export async function deriveKeyFromHeader(masterPassword: string, header: VaultFileHeader): Promise<Buffer> {
  const salt = fromBase64(header.salt)
  return deriveKey(masterPassword, salt, header.kdf)
}

export async function decryptVaultFile(file: VaultFile, masterPassword: string): Promise<VaultPayload> {
  const key = await deriveKeyFromHeader(masterPassword, file.header)
  return decryptVaultFileWithKey(file, key)
}

export async function decryptVaultFileWithKey(file: VaultFile, key: Buffer): Promise<VaultPayload> {
  if (!file?.header || file.header.magic !== MAGIC) {
    throw new Error('Invalid vault header')
  }
  if (file.header.version !== VERSION) {
    throw new Error(`Unsupported vault version ${file.header.version}`)
  }

  const nonce = fromBase64(file.header.nonce)
  const ciphertext = fromBase64(file.ciphertext)

  if (file.header.cipher === 'xchacha20-poly1305') {
    const sodium = await loadSodium()
    if (!sodium) {
      throw new Error('libsodium is required to decrypt this vault but is not available.')
    }
    const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      key
    )
    return JSON.parse(Buffer.from(plain).toString('utf8'))
  }

  if (file.header.cipher !== 'aes-256-gcm') {
    throw new Error('Unsupported cipher')
  }

  if (!file.header.tag) {
    throw new Error('Missing authentication tag')
  }

  const tag = fromBase64(file.header.tag)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plaintext.toString('utf8'))
}

export function serializeVaultFile(file: VaultFile): string {
  return JSON.stringify(file)
}

export function parseVaultFile(raw: string): VaultFile {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid vault file')
  }
  return parsed as VaultFile
}

export function getVaultHeaderDefaults(): { magic: string; version: number } {
  return { magic: MAGIC, version: VERSION }
}
