import Store from 'electron-store'
import type { ProviderId } from './types'

interface VaultSettings {
  activeProviderId: ProviderId
  localVaultPath: string
}

const store = new Store<VaultSettings>({
  projectName: 'passgen',
  name: 'passgen-settings',
  defaults: {
    activeProviderId: 'local',
    localVaultPath: ''
  }
})

export function getActiveProviderId(): ProviderId {
  return store.get('activeProviderId') || 'local'
}

export function setActiveProviderId(id: ProviderId): void {
  store.set('activeProviderId', id)
}

export function getLocalVaultPath(): string {
  return store.get('localVaultPath') || ''
}

export function setLocalVaultPath(path: string): void {
  store.set('localVaultPath', path)
}
