import { ConfigStore } from './configStore'
import type { ProviderId } from './storageTypes'

export type PremiumTier = 'free' | 'pro' | 'cloud' | 'byos'
export interface PlanCapabilities {
  canUseDevTools: boolean
  canInjectEnv: boolean
  canSeeHex: boolean
  dailyGenLimit: number | null
}

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
    return tier === 'cloud' || tier === 'byos'
  }

  if (provider === 's3-compatible' || provider === 'supabase') {
    return tier === 'byos'
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
    const planRaw = String(payload.plan || '').toLowerCase()
    const plan = planRaw === 'power' ? 'byos' : planRaw
    const allowed = ['free', 'pro', 'cloud', 'byos']
    localStorage.setItem('passgen-premium-tier', allowed.includes(plan) ? plan : 'cloud')
  } else {
    store.setPremium(false)
    localStorage.setItem('passgen-premium-tier', 'free')
  }
  const api = (window as any)?.nativeBridgeAPI
  if (api?.emit) {
    api.emit('premium:changed')
  }
}

export function getPlanCapabilities(plan?: string | PremiumTier): PlanCapabilities {
  const normalized = String(plan || getPremiumTier()).toLowerCase()
  const tier: PremiumTier =
    normalized === 'pro' ? 'pro' :
    normalized === 'cloud' ? 'cloud' :
    normalized === 'byos' || normalized === 'power' ? 'byos' :
    'free'

  if (tier === 'free') {
    return {
      canUseDevTools: true,
      canInjectEnv: false,
      canSeeHex: false,
      dailyGenLimit: 3
    }
  }

  return {
    canUseDevTools: true,
    canInjectEnv: true,
    canSeeHex: true,
    dailyGenLimit: null
  }
}
