import { contextBridge, ipcRenderer, clipboard } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  payment: {
    requestActivation: (payload: { email: string; requestId: string }) => ipcRenderer.invoke('payment:requestActivation', payload)
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
  getSessionToken: () => ipcRenderer.invoke('bridge:getToken')
})

declare global {
  interface Window {
    electron: {
      payment: {
        requestActivation: (payload: { email: string; requestId: string }) => Promise<{ success: boolean; error?: string }>
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
    }
  }
}
