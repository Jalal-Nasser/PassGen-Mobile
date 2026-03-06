import type { VaultRepository } from '../vault/vaultRepository'
import type { AppAccountSession } from '../vault/types'

const KEYTAR_SERVICE = 'PassGen'
const KEYTAR_ACCOUNT = 'desktop-session'

let keytar: any | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  keytar = require('keytar')
} catch {
  keytar = null
}

let cachedSession: AppAccountSession | null = null

export async function loadDesktopSession(vaultRepository: VaultRepository): Promise<AppAccountSession | null> {
  if (cachedSession) return cachedSession

  if (keytar) {
    const raw = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
    if (raw) {
      try {
        cachedSession = JSON.parse(raw)
        return cachedSession
      } catch {
        // ignore corrupted keytar payload
      }
    }
  }

  const vaultSession = vaultRepository.getAppAccountSession()
  if (vaultSession) {
    cachedSession = vaultSession
  }
  return cachedSession
}

export async function saveDesktopSession(session: AppAccountSession, vaultRepository: VaultRepository): Promise<void> {
  cachedSession = session

  if (keytar) {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, JSON.stringify(session))
    return
  }

  await vaultRepository.setAppAccountSession(session)
}

export async function clearDesktopSession(vaultRepository: VaultRepository): Promise<void> {
  cachedSession = null

  if (keytar) {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
  }

  await vaultRepository.clearAppAccountSession()
}

export function isKeytarAvailable(): boolean {
  return !!keytar
}
