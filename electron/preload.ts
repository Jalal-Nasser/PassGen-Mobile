import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  payment: {
    requestActivation: (payload: { email: string; requestId: string }) => ipcRenderer.invoke('payment:requestActivation', payload)
  }
})

declare global {
  interface Window {
    electron: {
      payment: {
        requestActivation: (payload: { email: string; requestId: string }) => Promise<{ success: boolean; error?: string }>
      }
    }
  }
}
