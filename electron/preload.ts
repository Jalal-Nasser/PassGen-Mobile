import { contextBridge, ipcRenderer, clipboard } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  payment: {
    requestActivation: (payload: { email: string; requestId: string; paymentMethod?: 'paypal' | 'crypto' }) => ipcRenderer.invoke('payment:requestActivation', payload)
  },
  clipboard: {
    writeText: async (text: string) => {
      try {
        clipboard.writeText(text)
        return true
      } catch {
        try {
          const ok = await ipcRenderer.invoke('clipboard:writeText', text)
          return !!ok
        } catch {
          return false
        }
      }
    },
    readText: async (): Promise<string> => {
      try {
        return clipboard.readText()
      } catch {
        try {
          const txt = await ipcRenderer.invoke('clipboard:readText')
          return String(txt || '')
        } catch {
          return ''
        }
      }
    }
  }
})

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  vaultUnlocked: () => ipcRenderer.send('vault:unlocked'),
  vaultLocked: () => ipcRenderer.send('vault:locked'),
  emit: (channel: string) => ipcRenderer.send(channel),
  getSessionToken: () => ipcRenderer.invoke('bridge:getToken'),
  saveVaultFile: (data: string) => ipcRenderer.invoke('vault:save', data),
  openVaultFile: () => ipcRenderer.invoke('vault:open'),
  registerPasskey: () => ipcRenderer.invoke('passkey:register'),
  verifyPasskey: () => ipcRenderer.invoke('passkey:verify'),
  passkeyStoreKey: (installId: string) => ipcRenderer.invoke('passkey:storeKey', installId),
  passkeyClearKey: (installId: string) => ipcRenderer.invoke('passkey:clearKey', installId),
  vaultStatus: () => ipcRenderer.invoke('vault:status'),
  vaultUnlock: (masterPassword: string) => ipcRenderer.invoke('vault:unlock', masterPassword),
  vaultUnlockWithPasskey: (installId: string) => ipcRenderer.invoke('vault:unlockWithPasskey', installId),
  vaultList: () => ipcRenderer.invoke('vault:list'),
  vaultAdd: (entry: any) => ipcRenderer.invoke('vault:add', entry),
  vaultUpdate: (entry: any) => ipcRenderer.invoke('vault:update', entry),
  vaultExportEncrypted: () => ipcRenderer.invoke('vault:exportEncrypted'),
  vaultImportEncrypted: (data: string) => ipcRenderer.invoke('vault:importEncrypted', data),
  vaultImportLegacy: (entries: Array<{ filename: string; data: string }>, masterPassword: string) => ipcRenderer.invoke('vault:importLegacy', entries, masterPassword),
  vaultRepair: () => ipcRenderer.invoke('vault:repair'),
  storageConfigure: (config: any) => ipcRenderer.invoke('storage:configure', config),
  storageProviderStatus: () => ipcRenderer.invoke('storage:providerStatus'),
  storageSelectVaultFolder: () => ipcRenderer.invoke('storage:selectVaultFolder'),
  storageTestS3: (config: any) => ipcRenderer.invoke('storage:testS3', config),
  storageS3SignedRequest: (config: any, key: string) => ipcRenderer.invoke('storage:s3SignedRequest', config, key),
  oauthGoogleDrive: () => ipcRenderer.invoke('oauth:google'),
  storageGoogleDriveConnect: () => ipcRenderer.invoke('storage:googleDriveConnect'),
  storageGoogleDriveDisconnect: () => ipcRenderer.invoke('storage:googleDriveDisconnect'),
  authLogin: (deviceId: string) => ipcRenderer.invoke('auth:login', deviceId),
  authGetSession: () => ipcRenderer.invoke('auth:getSession'),
  authGetMe: () => ipcRenderer.invoke('auth:getMe'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  licenseGetMe: () => ipcRenderer.invoke('license:getMe'),
  licenseRedeem: (payload: { licenseKey: string; deviceId?: string }) => ipcRenderer.invoke('license:redeem', payload),
  onAuthUpdated: (handler: (session: any) => void) => {
    const listener = (_event: any, session: any) => handler(session)
    ipcRenderer.on('auth:updated', listener)
    return () => ipcRenderer.removeListener('auth:updated', listener)
  }
})

declare global {
  interface Window {
    electron: {
      payment: {
        requestActivation: (payload: { email: string; requestId: string; paymentMethod?: 'paypal' | 'crypto' }) => Promise<{ success: boolean; error?: string }>
      }
      clipboard: {
        writeText: (text: string) => Promise<boolean>
        readText: () => Promise<string>
      }
    }
    electronAPI: {
      minimize: () => void
      maximize: () => void
      close: () => void
      vaultUnlocked: () => void
      vaultLocked: () => void
      getSessionToken: () => Promise<string>
      vaultStatus: () => Promise<{ hasVault: boolean; vaultPath: string; activeProviderId: string }>
      vaultUnlock: (masterPassword: string) => Promise<{ isNew: boolean }>
      vaultUnlockWithPasskey: (installId: string) => Promise<{ ok: boolean }>
      vaultList: () => Promise<any[]>
      vaultAdd: (entry: any) => Promise<void>
      vaultUpdate: (entry: any) => Promise<void>
      vaultExportEncrypted: () => Promise<string>
      vaultImportEncrypted: (data: string) => Promise<void>
      vaultImportLegacy: (entries: Array<{ filename: string; data: string }>, masterPassword: string) => Promise<{ imported: number; skipped: number }>
      vaultRepair: () => Promise<{ total: number; kept: number; migrated: number; removed: number }>
      storageConfigure: (config: any) => Promise<void>
      storageProviderStatus: () => Promise<any>
      storageSelectVaultFolder: () => Promise<{ success: boolean; folder?: string }>
      storageTestS3: (config: any) => Promise<{ ok: boolean; error?: string }>
      storageS3SignedRequest: (config: any, key: string) => Promise<Record<string, string>>
      oauthGoogleDrive: () => Promise<{ email: string; provider: 'google-drive'; token: any }>
      storageGoogleDriveConnect: () => Promise<{ email: string; provider: 'google-drive'; token: any }>
      storageGoogleDriveDisconnect: () => Promise<void>
      authLogin: (deviceId: string) => Promise<{ ok: boolean }>
      authGetSession: () => Promise<{ email?: string; userId?: string; plan?: string; isPremium?: boolean; expiresAt?: string | null } | null>
      authGetMe: () => Promise<{ userId: string; email: string; plan: string; isPremium: boolean; expiresAt: string | null }>
      authLogout: () => Promise<{ ok: boolean }>
      licenseGetMe: () => Promise<{ email: string; plan: string; isPremium: boolean }>
      licenseRedeem: (payload: { licenseKey: string; deviceId?: string }) => Promise<{ isPremium: boolean; plan: string; expiresAt?: string | null }>
      passkeyStoreKey: (installId: string) => Promise<{ ok: boolean }>
      passkeyClearKey: (installId: string) => Promise<{ ok: boolean }>
      onAuthUpdated: (handler: (session: any) => void) => () => void
    }
  }
}
