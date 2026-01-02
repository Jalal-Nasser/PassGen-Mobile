import { ConfigStore } from './configStore'
import type { ProviderId } from './storageTypes'

export type PremiumTier = 'free' | 'pro' | 'cloud' | 'byos'

export function isPremiumEnabled(): boolean {
  const store = new ConfigStore()
  return store.isPremium()
}

export function getPremiumTier(): PremiumTier {
  const raw = (localStorage.getItem('passgen-premium-tier') || '').toLowerCase()
  if (raw === 'pro' || raw === 'cloud' || raw === 'byos') {
    return raw
  }

  const store = new ConfigStore()
  return store.isPremium() ? 'cloud' : 'free'
}

export function isProviderAllowed(provider: ProviderId, tier: PremiumTier): boolean {
  if (provider === 'local') return true

  if (provider === 'google-drive' || provider === 'dropbox' || provider === 'onedrive') {
    return tier === 'cloud' || tier === 'byos' || isPremiumEnabled()
  }

  if (provider === 's3-compatible') {
    return tier === 'byos' || isPremiumEnabled()
  }

  return false
}

export function getEntryLimit(tier: PremiumTier): number | null {
  return tier === 'free' ? 4 : null
}

export function applyRemoteLicense(payload: { isPremium: boolean; plan?: string; expiresAt?: string | null } | null): void {
  const store = new ConfigStore()
  if (payload?.isPremium) {
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : undefined
    store.setPremium(true, expiresAt)
    const plan = String(payload.plan || '').toLowerCase()
    const allowed = ['free', 'pro', 'cloud', 'byos']
    localStorage.setItem('passgen-premium-tier', allowed.includes(plan) ? plan : 'cloud')
  } else {
    store.setPremium(false)
    localStorage.setItem('passgen-premium-tier', 'free')
  }
  const api = (window as any)?.electronAPI
  if (api?.emit) {
    api.emit('premium:changed')
  }
}
