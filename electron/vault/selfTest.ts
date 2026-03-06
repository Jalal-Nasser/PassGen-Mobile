import fs from 'fs'
import os from 'os'
import path from 'path'
import { createNewVaultFile, decryptVaultFileWithKey } from './crypto'
import { getActiveProviderId, setActiveProviderId, getLocalVaultPath, setLocalVaultPath } from './settingsStore'
import { LocalProvider } from './providers/localProvider'
import { S3CompatibleProvider } from './providers/s3CompatibleProvider'
import type { VaultPayload } from './types'

const TEST_META = {
  baseName: 'passgen-vault',
  contentType: 'application/octet-stream',
  retainCount: 2
}

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message)
}

export async function runVaultSelfTests(): Promise<void> {
  console.log('[VAULT TEST] Starting self-test...')

  await testCryptoRoundtrip()
  await testProviderPersistence()
  await testLocalVersioning()
  await testS3Signing()

  console.log('[VAULT TEST] All checks passed.')
}

async function testCryptoRoundtrip(): Promise<void> {
  const payload: VaultPayload = {
    vaultItems: [
      {
        id: '1',
        name: 'Test Entry',
        password: 'secret',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    providerConfigs: {
      activeProviderId: 'local',
      local: {
        vaultPath: '/tmp/passgen-test',
        backupsEnabled: true,
        keepLast: 2
      }
    },
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      vaultVersion: 1
    }
  }

  const { file, key } = await createNewVaultFile(payload, 'test-password')
  const decrypted = await decryptVaultFileWithKey(file, key)
  assert(decrypted.vaultItems.length === 1, 'Expected one vault item after decrypt')
  assert(decrypted.vaultItems[0].name === 'Test Entry', 'Vault item name mismatch')
  console.log('[VAULT TEST] Crypto roundtrip OK')
}

async function testProviderPersistence(): Promise<void> {
  const originalProvider = getActiveProviderId()
  const originalPath = getLocalVaultPath()

  setActiveProviderId('s3-compatible')
  setLocalVaultPath('/tmp/passgen-vault-test-path')

  assert(getActiveProviderId() === 's3-compatible', 'Provider selection did not persist')
  assert(getLocalVaultPath() === '/tmp/passgen-vault-test-path', 'Local path did not persist')

  // Restore original settings
  setActiveProviderId(originalProvider)
  setLocalVaultPath(originalPath)
  console.log('[VAULT TEST] Provider persistence OK')
}

async function testLocalVersioning(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'passgen-vault-test-'))
  const vaultPath = path.join(tmpDir, 'passgen-vault.pgvault')
  const provider = new LocalProvider({ vaultPath, backupsEnabled: true, keepLast: 2 })

  await provider.upload(Buffer.from('one'), TEST_META)
  await provider.upload(Buffer.from('two'), TEST_META)
  await provider.upload(Buffer.from('three'), TEST_META)

  const versions = await provider.listVersions()
  assert(versions.length <= 2, 'Local version retention failed')
  assert(fs.existsSync(vaultPath), 'Vault file not written')

  fs.rmSync(tmpDir, { recursive: true, force: true })
  console.log('[VAULT TEST] Local versioning OK')
}

async function testS3Signing(): Promise<void> {
  const provider = new S3CompatibleProvider({
    accessKeyId: 'AKIA_TEST',
    secretAccessKey: 'TEST_SECRET',
    region: 'us-east-1',
    bucket: 'test-bucket',
    endpoint: 'https://s3.amazonaws.com'
  })

  const valid = provider.validateConfig()
  assert(valid.ok, 'S3 config validation failed')

  const signed = await provider.createSignedRequest('passgen-vault-test.pgvault')
  const auth = signed.headers?.authorization || signed.headers?.Authorization
  assert(!!auth, 'Signed request missing Authorization header')
  console.log('[VAULT TEST] S3 signing OK')
}
