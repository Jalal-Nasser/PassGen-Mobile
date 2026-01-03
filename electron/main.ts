import { app, BrowserWindow, ipcMain, shell, Menu, dialog, clipboard } from 'electron'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
// Load environment variables from .env (dev + packaged extraResources)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv')
  const packagedCandidates = [
    path.join(process.resourcesPath || '', '.env'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', '.env')
  ]
  const devCandidates = [
    path.join(process.cwd(), 'resources', '.env'),
    path.join(process.cwd(), '.env')
  ]
  const candidates = app.isPackaged ? packagedCandidates : devCandidates
  let loaded = false
  if (app.isPackaged) {
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        dotenv.config({ path: candidate, override: true })
        console.log(`[ENV] Loaded .env from ${candidate}`)
        loaded = true
        break
      }
    }
  } else {
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        dotenv.config({ path: candidate, override: true })
        console.log(`[ENV] Loaded .env from ${candidate}`)
        loaded = true
      }
    }
  }
  if (!loaded) {
    console.warn('[ENV] No .env file found in expected locations')
  }
} catch (error) {
  console.warn('[ENV] Failed to load .env:', (error as Error).message)
}
import { VaultRepository } from './vault/vaultRepository'
import { runVaultSelfTests } from './vault/selfTest'
import { loadDesktopSession, saveDesktopSession, clearDesktopSession } from './auth/desktopSessionStore'
import type { AppAccountSession } from './vault/types'

let mainWindow: BrowserWindow | null = null;
let sessionToken: string | null = null;
let bridgeServer: http.Server | null = null;  // HTTP server for extension bridge (all modes)
const vaultRepository = new VaultRepository()
function resolveIconPath() {
  try {
    if (app.isPackaged) {
      // In production, files are under resources. We copy icon.png into dist at build time.
      return path.join(__dirname, '../dist/icon.png')
    }
    // In dev, load from public
    return path.join(process.cwd(), 'public', 'icon.png')
  } catch {
    return undefined as unknown as string
  }
}

const HELP_DOCS_URL = 'https://github.com/Jalal-Nasser/PassGen-Releases'
const HELP_ISSUES_URL = 'https://github.com/Jalal-Nasser/PassGen-Releases/issues'
const HELP_RELEASES_URL = 'https://github.com/Jalal-Nasser/PassGen/releases'
const HELP_WEBSITE_URL = 'https://mdeploy.dev'
const HELP_TERMS_URL = 'https://github.com/Jalal-Nasser/PassGen-Releases/blob/main/LICENSE.txt'
const KEYBOARD_SHORTCUTS_DETAIL =
  'Ctrl+C - Copy password\nCtrl+L - Lock vault\nCtrl+N - New password entry\nCtrl+F - Search vault\nCtrl+Q - Quit application\nF5 - Refresh\nF11 - Toggle fullscreen'
const ABOUT_DETAIL =
  'A secure password generator and vault.\n\nDeveloper: JalalNasser\nLicense: MIT\n\nFeatures:\n• Generate secure passwords\n• Encrypt and store passwords\n• Cloud sync (Premium)\n• Browser extension support\n\nPremium: $15 / 6 months for cloud sync and unlimited items.'

const AUTH_PROTOCOL = 'passgen'

function openDocumentation() {
  shell.openExternal(HELP_DOCS_URL)
}

function openTerms() {
  shell.openExternal(HELP_TERMS_URL)
}

function openReleases() {
  shell.openExternal(HELP_RELEASES_URL)
}

function showKeyboardShortcuts() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Keyboard Shortcuts',
    message: 'PassGen Keyboard Shortcuts',
    detail: KEYBOARD_SHORTCUTS_DETAIL,
    buttons: ['OK']
  })
}

function showAboutDialog() {
  const version = app.getVersion()
  dialog.showMessageBox({
    type: 'info',
    title: 'About PassGen',
    message: `PassGen v${version}`,
    detail: ABOUT_DETAIL,
    buttons: ['OK', 'Website', 'GitHub', 'Report Issue'],
    defaultId: 0,
    cancelId: 0
  }).then(({ response }) => {
    if (response === 1) shell.openExternal(HELP_WEBSITE_URL)
    if (response === 2) shell.openExternal(HELP_DOCS_URL)
    if (response === 3) shell.openExternal(HELP_ISSUES_URL)
  })
}

function getVercelBaseUrl(): string {
  const raw = process.env.VERCEL_APP_URL || ''
  if (!raw) {
    throw new Error('VERCEL_APP_URL is not configured')
  }
  return raw.replace(/\/+$/, '')
}

function buildDesktopLoginUrl(deviceId: string): string {
  const base = getVercelBaseUrl()
  return `${base}/desktop/login?device=${encodeURIComponent(deviceId)}`
}

function findProtocolUrl(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${AUTH_PROTOCOL}://`)) || null
}

function sanitizeSession(session: AppAccountSession | null) {
  if (!session) return null
  return {
    email: session.email,
    userId: session.userId,
    plan: session.plan,
    isPremium: session.isPremium,
    expiresAt: session.expiresAt
  }
}

async function notifyAuthUpdated(session: AppAccountSession | null) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('auth:updated', sanitizeSession(session))
}

async function refreshDesktopSession(session: AppAccountSession): Promise<AppAccountSession> {
  if (!session.refreshToken || !session.deviceId) {
    throw new Error('Missing refresh token for desktop session')
  }
  const response = await fetch(`${getVercelBaseUrl()}/api/desktop/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken, deviceId: session.deviceId })
  })

  if (!response.ok) {
    throw new Error(`Refresh failed (${response.status})`)
  }

  const data = await response.json()
  const updated: AppAccountSession = {
    ...session,
    accessToken: data.accessToken,
    accessExpiresAt: data.accessExpiresAt,
    refreshToken: data.refreshToken || session.refreshToken,
    refreshExpiresAt: data.refreshExpiresAt || session.refreshExpiresAt
  }
  await saveDesktopSession(updated, vaultRepository)
  return updated
}

async function handleAuthCallbackUrl(rawUrl: string): Promise<void> {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== `${AUTH_PROTOCOL}:`) return
    if (url.hostname !== 'auth-callback') return

    const accessToken = url.searchParams.get('token') || ''
    if (!accessToken) return

    const session: AppAccountSession = {
      accessToken,
      accessExpiresAt: url.searchParams.get('expires') || undefined,
      refreshToken: url.searchParams.get('refresh') || undefined,
      refreshExpiresAt: url.searchParams.get('refreshExpires') || undefined,
      deviceId: url.searchParams.get('device') || undefined
    }

    await saveDesktopSession(session, vaultRepository)
    await notifyAuthUpdated(session)
    if (process.argv.includes('--auth-test')) {
      console.log('[AUTH TEST] Session stored for desktop login')
    }
  } catch (error) {
    console.error('[AUTH] Failed to handle callback:', (error as Error).message)
  }
}

async function fetchAuthMe(): Promise<{ userId: string; email: string; plan: string; isPremium: boolean; expiresAt: string | null }> {
  const session = await loadDesktopSession(vaultRepository)
  if (!session?.accessToken) {
    throw new Error('No active app session')
  }
  let response = await fetch(`${getVercelBaseUrl()}/api/me`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    }
  })

  if (response.status === 401 && session.refreshToken) {
    const refreshed = await refreshDesktopSession(session)
    response = await fetch(`${getVercelBaseUrl()}/api/me`, {
      headers: {
        Authorization: `Bearer ${refreshed.accessToken}`
      }
    })
  }

  if (!response.ok) {
    throw new Error(`Auth request failed (${response.status})`)
  }

  const data = await response.json()
  const updated: AppAccountSession = {
    ...session,
    email: data.email,
    userId: data.userId,
    plan: data.plan,
    isPremium: data.isPremium,
    expiresAt: data.expiresAt || null
  }
  await saveDesktopSession(updated, vaultRepository)
  await notifyAuthUpdated(updated)
  return data
}

function setApplicationMenu() {
  // Query localStorage to check premium status
  let isPremium = false
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript('localStorage.getItem("passgen-premium")').then(result => {
      // Just rebuild menu after checking
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: 'File',
          submenu: [
            {
              label: 'Settings',
              accelerator: 'CmdOrCtrl+,',
              click: () => {
                mainWindow?.webContents.executeJavaScript(`window.dispatchEvent(new Event('open-settings'))`)
              }
            },
            ...(result === 'true' ? [] : [{
              label: 'Upgrade to Premium',
              click: () => {
                mainWindow?.webContents.executeJavaScript(`window.dispatchEvent(new Event('open-upgrade'))`)
              }
            } as Electron.MenuItemConstructorOptions, { type: 'separator' } as Electron.MenuItemConstructorOptions]),
            { role: 'quit' } as Electron.MenuItemConstructorOptions
          ]
        },
        {
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
          ]
        },
        {
          label: 'Window',
          submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            { role: 'close' }
          ]
        },
        {
          label: 'Help',
          submenu: [
            {
              label: 'Documentation',
              click: openDocumentation
            },
            {
              label: 'Keyboard Shortcuts',
              click: showKeyboardShortcuts
            },
            { type: 'separator' },
            {
              label: 'Check for Updates',
              click: () => { checkForUpdates(false) }
            },
            {
              label: 'GitHub Releases',
              click: openReleases
            },
            {
              label: 'About PassGen',
              click: showAboutDialog
            },
            { type: 'separator' },
            {
              label: 'Terms (EULA)',
              click: openTerms
            }
          ]
        }
      ]
      Menu.setApplicationMenu(Menu.buildFromTemplate(template))
    }).catch(() => {
      // Fallback: build default menu without checking
      buildDefaultMenu()
    })
  } else {
    buildDefaultMenu()
  }
}

function buildDefaultMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.executeJavaScript(`window.dispatchEvent(new Event('open-settings'))`)
          }
        },
        {
          label: 'Upgrade to Premium',
          click: () => {
            mainWindow?.webContents.executeJavaScript(`window.dispatchEvent(new Event('open-upgrade'))`)
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: openDocumentation
        },
        {
          label: 'Keyboard Shortcuts',
          click: showKeyboardShortcuts
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => { checkForUpdates(false) }
        },
        {
          label: 'GitHub Releases',
          click: openReleases
        },
        {
          label: 'About PassGen',
          click: showAboutDialog
        },
        { type: 'separator' },
        {
          label: 'Terms (EULA)',
          click: openTerms
        }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function parseSemver(v: string): [number, number, number] {
  const m = (v || '').trim().replace(/^v/, '').split('.')
  const toNum = (x: string) => {
    const n = Number(x)
    return Number.isFinite(n) ? n : 0
  }
  return [toNum(m[0]||'0'), toNum(m[1]||'0'), toNum(m[2]||'0')]
}

function isNewer(latest: string, current: string): boolean {
  const [la, lb, lc] = parseSemver(latest)
  const [ca, cb, cc] = parseSemver(current)
  if (la !== ca) return la > ca
  if (lb !== cb) return lb > cb
  return lc > cc
}

async function checkForUpdates(silent = false) {
  try {
    const current = app.getVersion().replace(/^v/, '')
    const js = `(
      async () => {
        // Fetch latest release from the main PassGen repo
        const res = await fetch('https://api.github.com/repos/Jalal-Nasser/PassGen/releases/latest');
        const data = await res.json();
        return { tag: (data.tag_name||'').replace(/^v/, ''), url: data.html_url||'' }
      }
    )()`
    const { tag, url } = await (mainWindow?.webContents.executeJavaScript(js).catch(()=>({tag:'',url:''})) || Promise.resolve({tag:'',url:''}))
    if (tag && isNewer(tag, current)) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version ${tag} is available`,
        detail: 'Click Download to open the releases page.',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then(({ response }) => {
        if (response === 0 && url) shell.openExternal(url)
      })
    } else if (!silent) {
      dialog.showMessageBox({ type: 'info', title: 'PassGen', message: 'You have the latest version.' })
    }
  } catch (e) {
    if (!silent) dialog.showMessageBox({ type: 'warning', title: 'Update Check Failed', message: String((e as Error).message||e) })
  }
}

function createWindow() {
  // Prevent multiple windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    icon: resolveIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })
  mainWindow.center()

  // In development, use the Vite dev server
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL

  const forceFileInDev = process.env.PASSGEN_USE_FILE_DEV === 'true'
  if (isDev && !forceFileInDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(devServerUrl)
  } else {
    // file:// load (used in production and when PASSGEN_USE_FILE_DEV=true) to share the same origin/storage
    const distIndex = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(distIndex)
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[WINDOW] did-fail-load:', { errorCode, errorDescription, validatedURL })
  })

  mainWindow.webContents.on('crashed', () => {
    console.error('[WINDOW] Renderer process crashed!')
  })

  // Add loading indicator
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[WINDOW] App finished loading')
    // Check if localStorage is accessible
    mainWindow?.webContents.executeJavaScript(`
      (function() {
        try {
          const test = localStorage.getItem('passgen-install-id');
          console.log('[STORAGE CHECK] localStorage accessible, found passgen-install-id:', test ? 'YES' : 'NO');
          if (!test) {
            console.log('[STORAGE CHECK] This is first-time setup or storage was cleared');
          }
        } catch (e) {
          console.error('[STORAGE CHECK] Error accessing localStorage:', e.message);
        }
      })()
    `).catch(err => {
      console.error('[WINDOW] Error checking storage on load:', err)
    })
  })
}

// Window control IPC handlers
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close()
})

ipcMain.on('help:documentation', () => {
  openDocumentation()
})

ipcMain.on('help:shortcuts', () => {
  showKeyboardShortcuts()
})

ipcMain.on('help:check-updates', () => {
  checkForUpdates(false)
})

ipcMain.on('help:releases', () => {
  openReleases()
})

ipcMain.on('help:about', () => {
  showAboutDialog()
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(AUTH_PROTOCOL)
  } else {
    const appPath = path.resolve(process.argv[1] || '')
    app.setAsDefaultProtocolClient(AUTH_PROTOCOL, process.execPath, appPath ? [appPath] : [])
  }

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleAuthCallbackUrl(url)
  })

  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const protocolUrl = findProtocolUrl(argv || [])
    if (protocolUrl) {
      handleAuthCallbackUrl(protocolUrl)
    }
  });

  // Configure persistent session for localStorage preservation
  // Note: partition: 'persist:passgen' in BrowserWindow webPreferences
  // automatically persists localStorage to disk in app userData directory

  app.whenReady().then(() => {
    if (process.argv.includes('--vault-self-test')) {
      runVaultSelfTests()
        .then(() => app.quit())
        .catch((error) => {
          console.error('[VAULT TEST] Failed:', error)
          app.quit()
        })
      return
    }
    createWindow()
    setApplicationMenu()
    // Initial update check and periodic checks every 6 hours
    setTimeout(() => checkForUpdates(true), 5000)
    setInterval(() => checkForUpdates(true), 6 * 60 * 60 * 1000)
    startBridgeServer()

    const initialProtocolUrl = findProtocolUrl(process.argv || [])
    if (initialProtocolUrl) {
      handleAuthCallbackUrl(initialProtocolUrl)
    }

    if (process.argv.includes('--oauth-ipc-test')) {
      mainWindow?.webContents.once('did-finish-load', async () => {
        try {
          console.log('[OAUTH TEST] Triggering IPC OAuth flow...')
          const result = await mainWindow?.webContents.executeJavaScript('window.electronAPI.oauthGoogleDrive()')
          console.log('[OAUTH TEST] Success:', result)
        } catch (error) {
          console.error('[OAUTH TEST] Failed:', (error as Error).message)
        } finally {
          setTimeout(() => app.quit(), 1500)
        }
      })
    }

    if (process.argv.includes('--auth-test')) {
      mainWindow?.webContents.once('did-finish-load', async () => {
        try {
          const deviceId = await mainWindow?.webContents.executeJavaScript('localStorage.getItem("passgen-install-id") || "passgen-dev-device"')
          console.log('[AUTH TEST] Opening login for device:', deviceId)
          await shell.openExternal(buildDesktopLoginUrl(String(deviceId)))
        } catch (error) {
          console.error('[AUTH TEST] Failed to start login:', (error as Error).message)
        }
      })
    }

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  stopBridgeServer()
  app.quit();
})

// Handle payment activation request
ipcMain.handle('payment:requestActivation', async (_event, payload: { email: string; requestId: string; paymentMethod?: 'paypal' | 'crypto' }) => {
  try {
    const defaultSupabaseUrl = 'https://ylzxeyqlqvziwnradcmy.supabase.co'
    const defaultSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsenhleXFscXZ6aXducmFkY215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjIzMTAsImV4cCI6MjA4MTAzODMxMH0.e-0bhGJnlEC_hJ-DUiICu9KoZ0753bSp4QaIuamNG7o'
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseKey

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/activation-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          install_id: payload.requestId,
          user_email: payload.email,
          payment_method: payload.paymentMethod || 'paypal',
          payment_amount: 15.00
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      console.log('[PAYMENT] Activation request saved via Edge Function')
      return { success: true }
    } catch (apiError) {
      console.error('[PAYMENT] Edge Function error:', apiError)
      // Fallback to direct Supabase insertion if Edge Function fails
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { error } = await supabase
          .from('activation_requests')
          .insert({
            install_id: payload.requestId,
            user_email: payload.email,
            payment_method: payload.paymentMethod || 'paypal',
            payment_amount: 15.00,
            payment_currency: 'USD',
            status: 'pending'
          })

        if (error) {
          throw error
        }

        console.log('[PAYMENT] Activation request saved via Supabase client fallback')
        return { success: true }
      } catch (fallbackError) {
        console.error('[PAYMENT] Fallback save error:', fallbackError)
        return { success: false, error: 'Failed to send activation request. Please try again later.' }
      }
    }
  } catch (err) {
    console.error('[PAYMENT] Activation request failed:', err)
    return { success: false, error: 'Failed to send activation request. Please try again later.' }
  }
})

// Clipboard IPC fallbacks
ipcMain.handle('clipboard:writeText', async (_event, text: string) => {
  try {
    clipboard.writeText(String(text ?? ''))
    return true
  } catch {
    return false
  }
})

ipcMain.handle('clipboard:readText', async () => {
  try {
    return clipboard.readText()
  } catch {
    return ''
  }
})

// Expose current session token to renderer (read-only)
ipcMain.handle('bridge:getToken', async () => {
  return sessionToken || ''
})

// Vault storage IPC
ipcMain.handle('vault:status', async () => {
  return vaultRepository.getStatus()
})

ipcMain.handle('vault:unlock', async (_event, masterPassword: string) => {
  return vaultRepository.unlock(masterPassword)
})

ipcMain.handle('vault:list', async () => {
  return vaultRepository.listEntries()
})

ipcMain.handle('vault:add', async (_event, entry) => {
  return vaultRepository.addEntry(entry)
})

ipcMain.handle('vault:update', async (_event, entry) => {
  return vaultRepository.updateEntry(entry)
})

ipcMain.handle('vault:exportEncrypted', async () => {
  return vaultRepository.exportEncrypted()
})

ipcMain.handle('vault:importEncrypted', async (_event, data: string) => {
  return vaultRepository.importEncrypted(data)
})

ipcMain.handle('vault:importLegacy', async (_event, entries: Array<{ filename: string; data: string }>, masterPassword: string) => {
  return vaultRepository.importLegacyEntries(entries, masterPassword)
})

ipcMain.handle('vault:repair', async () => {
  return vaultRepository.repairVault()
})

ipcMain.handle('auth:login', async (_event, deviceId: string) => {
  if (!deviceId) {
    throw new Error('Missing device id')
  }
  const loginUrl = buildDesktopLoginUrl(deviceId)
  await shell.openExternal(loginUrl)
  return { ok: true }
})

ipcMain.handle('auth:getSession', async () => {
  const session = await loadDesktopSession(vaultRepository)
  return sanitizeSession(session)
})

ipcMain.handle('auth:getMe', async () => {
  return fetchAuthMe()
})

ipcMain.handle('auth:logout', async () => {
  await clearDesktopSession(vaultRepository)
  await notifyAuthUpdated(null)
  return { ok: true }
})

ipcMain.handle('license:getMe', async () => {
  const baseUrl = (() => {
    try {
      return getVercelBaseUrl()
    } catch (error) {
      console.warn('[LICENSE DEBUG] Missing VERCEL_APP_URL:', (error as Error).message)
      return ''
    }
  })()
  const requestUrl = baseUrl ? `${baseUrl}/api/me` : ''
  console.log('[LICENSE DEBUG] VERCEL_APP_URL=', baseUrl || 'MISSING')
  console.log('[LICENSE DEBUG] requestUrl=', requestUrl || 'MISSING')

  const session = await loadDesktopSession(vaultRepository)
  if (!session?.accessToken) {
    console.log('[LICENSE DEBUG] No desktop session access token')
    throw new Error('Not authenticated / invalid desktop token')
  }

  let response: Response | null = null
  let responseText = ''
  try {
    response = await fetch(requestUrl, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      }
    })
    responseText = await response.text()
  } catch (error) {
    console.log('[LICENSE DEBUG] request failed:', (error as Error).message)
    throw error
  }

  console.log('[LICENSE DEBUG] status=', response.status)
  console.log('[LICENSE DEBUG] body=', responseText.slice(0, 200))

  if (response.status === 401 || response.status === 403) {
    throw new Error('Not authenticated / invalid desktop token')
  }
  if (!response.ok) {
    throw new Error(`License request failed (${response.status})`)
  }

  const data = JSON.parse(responseText || '{}')
  return { email: data.email, plan: data.plan, isPremium: data.isPremium }
})

ipcMain.handle('storage:configure', async (_event, config) => {
  return vaultRepository.configureStorage(config)
})

ipcMain.handle('storage:providerStatus', async () => {
  return vaultRepository.getProviderStatus()
})

ipcMain.handle('storage:selectVaultFolder', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Vault Folder',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return { success: false }
  return { success: true, folder: result.filePaths[0] }
})

ipcMain.handle('storage:testS3', async (_event, config) => {
  return vaultRepository.testS3Connection(config)
})

ipcMain.handle('storage:s3SignedRequest', async (_event, config, key: string) => {
  return vaultRepository.getSignedS3Request(config, key)
})

ipcMain.handle('oauth:google', async () => {
  return vaultRepository.connectGoogleDrive()
})

ipcMain.handle('storage:googleDriveConnect', async () => {
  return vaultRepository.connectGoogleDrive()
})

ipcMain.handle('storage:googleDriveDisconnect', async () => {
  return vaultRepository.disconnectGoogleDrive()
})

// Vault export/import file dialogs
ipcMain.handle('vault:save', async (_event, data: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Vault Backup',
    defaultPath: `passgen-vault-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { success: false }
  try {
    const fs = require('fs')
    fs.writeFileSync(filePath, data, 'utf8')
    return { success: true, path: filePath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
})

ipcMain.handle('vault:open', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: 'Import Vault Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths || filePaths.length === 0) return { success: false }
  try {
    const fs = require('fs')
    const data = fs.readFileSync(filePaths[0], 'utf8')
    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
})

// Passkey registration and verification handlers
ipcMain.handle('passkey:register', async () => {
  try {
    if (!mainWindow) return { success: false, error: 'Window not available' }
    // Delegate WebAuthn registration to renderer via JavaScript
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          const challenge = crypto.getRandomValues(new Uint8Array(32));
          console.log('Creating passkey credential...');
          const credential = await navigator.credentials.create({
            publicKey: {
              challenge: challenge,
              rp: { name: "PassGen" },
              user: {
                id: crypto.getRandomValues(new Uint8Array(16)),
                name: "passgen-user",
                displayName: "PassGen User"
              },
              pubKeyCredParams: [{ type: "public-key", alg: -7 }],
              timeout: 60000,
              attestation: "none"
            }
          });
          if (!credential) {
            throw new Error('Passkey registration cancelled or not supported on this device');
          }
          if (credential.type !== 'public-key') {
            throw new Error('Invalid credential type: ' + credential.type);
          }
          // Just store the credential ID, which is sufficient for verification
          const credentialId = Array.from(new Uint8Array(credential.id)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
          console.log('Passkey registered with ID:', credentialId);
          return {
            credentialId: credentialId,
            // Store a simple marker that we have a passkey registered
            publicKey: 'passkey-registered'
          };
        } catch (err) {
          console.error('Passkey error:', err.message);
          throw err;
        }
      })()
    `)
    return { success: true, ...result }
  } catch (e) {
    console.error('Passkey registration handler error:', e)
    return { success: false, error: (e as Error).message || 'Unknown error during passkey registration' }
  }
})

ipcMain.handle('passkey:verify', async () => {
  try {
    if (!mainWindow) return { success: false, error: 'Window not available' }
    // Delegate WebAuthn verification to renderer
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge: challenge,
            timeout: 60000,
            userVerification: "preferred"
          }
        });
        if (!assertion) throw new Error('Passkey verification failed');
        return {
          id: Array.from(new Uint8Array(assertion.id)).map(b => ('0' + b.toString(16)).slice(-2)).join(''),
          verified: true
        };
      })()
    `)
    return { success: true, ...result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
})

// Session token management for extension bridge
function generateSessionToken(): string {
  const buf = Buffer.alloc(16)
  for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256)
  return buf.toString('hex')
}

ipcMain.on('vault:unlocked', () => {
  sessionToken = generateSessionToken()
})

ipcMain.on('vault:locked', () => {
  sessionToken = null
})

ipcMain.on('premium:changed', () => {
  setApplicationMenu()
})

function startBridgeServer() {
  try {
    if (bridgeServer) return
    bridgeServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1')
        const origin = req.headers['origin'] as string | undefined
        const allow = !origin || origin.startsWith('chrome-extension://') || origin.startsWith('edge-extension://')
        if (!allow) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        if (url.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (url.pathname === '/credentials') {
          const token = (req.headers['x-passgen-session'] as string) || url.searchParams.get('token') || ''
          if (!sessionToken || token !== sessionToken) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'locked' }))
            return
          }
          const domain = url.searchParams.get('domain') || ''
          const names = await getCandidateNames(domain)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ domain, names }))
          return
        }

        if (url.pathname === '/fill') {
          const token = (req.headers['x-passgen-session'] as string) || url.searchParams.get('token') || ''
          if (!sessionToken || token !== sessionToken) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'locked' }))
            return
          }
          let body = ''
          req.on('data', (chunk) => body += chunk)
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}')
              const { id } = payload
              const creds = await getCredentialsById(id)
              if (!creds) {
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'not_found' }))
                return
              }
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ username: creds.username || '', password: creds.password }))
            } catch (e: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'bad_request', detail: e?.message || String(e) }))
            }
          })
          return
        }

        res.writeHead(404)
        res.end('Not Found')
      } catch {
        res.writeHead(500)
        res.end('Server Error')
      }
    })
    bridgeServer.listen(17865, '127.0.0.1')
  } catch (e) {
    console.error('Bridge server failed to start:', e)
  }
}

function stopBridgeServer() {
  try { bridgeServer?.close() } catch {}
  bridgeServer = null
}

async function getCandidateNames(domain: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const web = mainWindow?.webContents
    if (!web) return []
    const list = await web.executeJavaScript('window.__passgen_listEntries?.()').catch(() => [])
    const arr = Array.isArray(list) ? list : []
    const m = domain?.toLowerCase() || ''
    return arr.filter((e: any) => (e?.url || '').toLowerCase().includes(m) || (e?.name || '').toLowerCase().includes(m)).map((e: any) => ({ id: e.id, name: e.name }))
  } catch {
    return []
  }
}

async function getCredentialsById(id: string): Promise<{ username?: string; password: string } | null> {
  try {
    const web = mainWindow?.webContents
    if (!web) return null
    const entry = await web.executeJavaScript('window.__passgen_getEntryById?.(' + JSON.stringify(id) + ')').catch(() => null)
    if (!entry) return null
    return entry as { username?: string; password: string }
  } catch {
    return null
  }
}
