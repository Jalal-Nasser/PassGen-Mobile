import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Clipboard } from '@capacitor/clipboard'

const VAULT_FILE_NAME = 'passgen-vault.pgvault'

let inMemoryVault: any = null
let currentKey: CryptoKey | null = null
let currentHeader: any = null

const MAGIC = 'PASSGENVAULT'
const VERSION = 1

// Helpers
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64)
  const len = binary_string.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i)
  }
  return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer
}

async function getVaultFile(): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({
      path: VAULT_FILE_NAME,
      directory: Directory.Data,
      encoding: Encoding.UTF8
    })
    return typeof result.data === 'string' ? result.data : null
  } catch (e) {
    return null
  }
}

async function saveVaultFile(contents: string): Promise<void> {
  await Filesystem.writeFile({
    path: VAULT_FILE_NAME,
    directory: Directory.Data,
    data: contents,
    encoding: Encoding.UTF8
  })
}

async function deriveKey(password: string, saltBuffer: ArrayBuffer, iter: number): Promise<CryptoKey> {
  const pwKey = await window.crypto.subtle.importKey(
    'raw',
    stringToArrayBuffer(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: iter,
      hash: 'SHA-256'
    },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

async function decryptVault(rawJson: string, password: string): Promise<any> {
  const parsed = JSON.parse(rawJson)
  if (parsed?.header?.magic !== MAGIC) throw new Error('Invalid vault header')
  if (parsed.header.kdf.alg !== 'pbkdf2-sha256') {
    throw new Error('This vault uses an unsupported hashing algorithm on mobile (' + parsed.header.kdf.alg + ').')
  }

  const saltBuf = base64ToArrayBuffer(parsed.header.salt)
  const nonceBuf = base64ToArrayBuffer(parsed.header.nonce)
  const tagBytes = new Uint8Array(base64ToArrayBuffer(parsed.header.tag))
  const ciphertextBytes = new Uint8Array(base64ToArrayBuffer(parsed.ciphertext))
  
  // Combine ciphertext + tag for WebCrypto AES-GCM
  const combined = new Uint8Array(ciphertextBytes.length + tagBytes.length)
  combined.set(ciphertextBytes)
  combined.set(tagBytes, ciphertextBytes.length)

  const key = await deriveKey(password, saltBuf, parsed.header.kdf.params.iterations)
  const decryptedBuf = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonceBuf },
    key,
    combined.buffer
  )

  const decryptedText = new TextDecoder().decode(decryptedBuf)
  currentKey = key
  currentHeader = parsed.header
  return JSON.parse(decryptedText)
}

async function persistVault() {
  if (!inMemoryVault || !currentKey || !currentHeader) return

  const nonceBytes = window.crypto.getRandomValues(new Uint8Array(12))
  const plaintext = stringToArrayBuffer(JSON.stringify(inMemoryVault))
  
  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBytes },
    currentKey,
    plaintext
  )

  // Split WebCrypto combined buffer back into ciphertext and tag
  const encryptedBytes = new Uint8Array(encryptedBuf)
  const tagBytes = encryptedBytes.slice(-16)
  const cipherBytes = encryptedBytes.slice(0, -16)

  currentHeader.nonce = arrayBufferToBase64(nonceBytes.buffer)
  currentHeader.tag = arrayBufferToBase64(tagBytes.buffer)

  const newVaultFile = {
    header: currentHeader,
    ciphertext: arrayBufferToBase64(cipherBytes.buffer)
  }

  inMemoryVault.meta.updatedAt = new Date().toISOString()
  await saveVaultFile(JSON.stringify(newVaultFile))
}

export const capacitorNativeBridgeAPI = {
  minimize: () => {},
  maximize: () => {},
  close: () => {},
  
  vaultStatus: async () => {
    const file = await getVaultFile()
    return {
      hasVault: !!file,
      vaultPath: 'mobile-storage',
      activeProviderId: 'local'
    }
  },

  vaultUnlock: async (masterPassword: string) => {
    const file = await getVaultFile()
    if (file) {
      inMemoryVault = await decryptVault(file, masterPassword)
      return { isNew: false }
    } else {
      // Create new vault
      const saltBuf = window.crypto.getRandomValues(new Uint8Array(16))
      const key = await deriveKey(masterPassword, saltBuf.buffer, 310000)
      
      currentKey = key
      currentHeader = {
        magic: MAGIC,
        version: VERSION,
        kdf: { alg: 'pbkdf2-sha256', params: { keyLength: 32, iterations: 310000 } },
        salt: arrayBufferToBase64(saltBuf.buffer),
        nonce: '',
        cipher: 'aes-256-gcm',
        tag: ''
      }
      
      inMemoryVault = {
        vaultItems: [],
        providerConfigs: { activeProviderId: 'local', local: { backupsEnabled: true, keepLast: 10 } },
        meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), vaultVersion: 1 }
      }
      
      await persistVault()
      return { isNew: true }
    }
  },
  
  vaultList: async () => {
    return inMemoryVault?.vaultItems || []
  },

  vaultAdd: async (entry: any) => {
    if (!inMemoryVault) throw new Error('Locked')
    inMemoryVault.vaultItems.push(entry)
    await persistVault()
  },

  vaultUpdate: async (entry: any) => {
    if (!inMemoryVault) throw new Error('Locked')
    const idx = inMemoryVault.vaultItems.findIndex((i: any) => i.id === entry.id)
    if (idx !== -1) inMemoryVault.vaultItems[idx] = entry
    await persistVault()
  },
  
  vaultExportEncrypted: async () => await getVaultFile(),
  vaultImportEncrypted: async (data: string) => await saveVaultFile(data),
  
  // Dummy methods for unsupported desktop features
  vaultRepair: async () => ({ total: 0, kept: 0, migrated: 0, removed: 0 }),
  storageProviderStatus: async () => ({ activeProviderId: 'local' }),
  storageConfigure: async () => {},
  openExternal: async () => ({ ok: false }),
  settingsGet: async () => ({ minimizeToTray: false }),
  settingsSet: async () => ({ minimizeToTray: false }),
  onAuthUpdated: () => () => {},
  getSessionToken: async () => ''
}

export const capacitorNativeClipboard = {
  writeText: async (text: string) => {
    await Clipboard.write({ string: text })
    return true
  },
  readText: async () => {
    const { type, value } = await Clipboard.read()
    return type === 'text/plain' ? value : ''
  }
}
