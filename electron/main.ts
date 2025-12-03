import { app, BrowserWindow, ipcMain, shell, Menu, dialog, clipboard } from 'electron'
import * as http from 'http'
// Load environment variables from .env if present (development convenience)
try {
  // Dynamically require without adding type dep; ignore if not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv')
  dotenv.config()
} catch {}
import * as path from 'path'

let mainWindow: BrowserWindow | null = null;
let sessionToken: string | null = null;
let server: http.Server | null = null;

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

function setApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
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
          label: 'Check for Updates',
          click: () => {
            mainWindow?.webContents.executeJavaScript(`
              (async () => {
                try {
                  const res = await fetch('https://api.github.com/repos/Jalal-Nasser/PassGen-Releases/releases/latest');
                  const data = await res.json();
                  const latest = data.tag_name?.replace(/^v/, '');
                  const url = data.html_url;
                  const current = '1.0.4';
                  if (latest && latest !== current) {
                    if (confirm('New version ' + latest + ' available! Go to download page?')) {
                      window.open(url, '_blank');
                    }
                  } else {
                    alert('You have the latest version.');
                  }
                } catch(e) {
                  alert('Update check failed: ' + e.message);
                }
              })()
            `).catch(() => {})
          }
        },
        {
          label: 'About PassGen',
          click: () => {
            const version = app.getVersion()
            dialog.showMessageBox({
              type: 'info',
              title: 'About PassGen',
              message: `PassGen\nVersion ${version}`,
              detail: 'A secure password generator and vault.\nDeveloper: JalalNasser\nPremium: $3.99/mo for cloud sync and unlimited items.',
              buttons: ['OK', 'Downloads', 'Report Issue'],
              defaultId: 0,
              cancelId: 0
            }).then(({ response }) => {
              if (response === 1) shell.openExternal('https://github.com/Jalal-Nasser/PassGen-Releases/releases')
              if (response === 2) shell.openExternal('https://github.com/Jalal-Nasser/PassGen-Releases/issues')
            })
          }
        },
        { type: 'separator' },
        {
          label: 'Terms (EULA)',
          click: () => shell.openExternal('https://github.com/Jalal-Nasser/PassGen-Releases/blob/main/LICENSE.txt')
        }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function checkForUpdates(silent = false) {
  try {
    const current = app.getVersion().replace(/^v/, '')
    const js = `(
      async () => {
        const res = await fetch('https://api.github.com/repos/Jalal-Nasser/PassGen-Releases/releases/latest');
        const data = await res.json();
        return { tag: (data.tag_name||'').replace(/^v/, ''), url: data.html_url||'' }
      }
    )()`
    const { tag, url } = await (mainWindow?.webContents.executeJavaScript(js).catch(()=>({tag:'',url:''})) || Promise.resolve({tag:'',url:''}))
    if (tag && tag !== current) {
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
  
  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(devServerUrl)
    // Don't open dev tools automatically
  } else {
    // Production: load from dist folder
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
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

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow()
    setApplicationMenu()
    // Initial update check and periodic checks every 6 hours
    setTimeout(() => checkForUpdates(true), 5000)
    setInterval(() => checkForUpdates(true), 6 * 60 * 60 * 1000)
    startBridgeServer()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  stopBridgeServer()
  app.quit();
})

// Handle payment activation email request
ipcMain.handle('payment:requestActivation', async (_event, payload: { email: string; requestId: string }) => {
  // Safe default so end-users can request activation via mailto without any env vars
  const defaultSeller = 'git@mdeploy.dev'
  const seller = process.env.SELLER_EMAIL || defaultSeller
  const smtpUser = process.env.ZOHO_USER || ''
  const smtpPass = process.env.ZOHO_PASS || ''
  const smtpHost = process.env.ZOHO_HOST || 'smtp.zoho.com'
  const smtpPort = Number(process.env.ZOHO_PORT || 465)
  // If port is 587 use STARTTLS (secure=false), if 465 use SSL (secure=true), otherwise use env toggle
  const smtpSecure = smtpPort === 465 ? true : (smtpPort === 587 ? false : String(process.env.ZOHO_SECURE || 'true') === 'true')

  const subject = `PassGen Premium Activation Request – ${payload.requestId}`
  const body = `A user clicked "I've paid" in PassGen\n\nInstall/Request ID: ${payload.requestId}\nUser Email: ${payload.email || '(not provided)'}\nPlan: Premium $3.99/mo\nTime: ${new Date().toISOString()}\n\nPlease verify payment on PayPal and send activation code.`

  // Try SMTP via nodemailer, fallback to mailto if not configured or fails
  try {
    if (seller && smtpUser && smtpPass) {
      const nodemailerMod = await import('nodemailer')
      const nodemailer = (nodemailerMod as any).default || (nodemailerMod as any)
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
      })
      await transporter.verify().catch(()=>{})
      await transporter.sendMail({ from: seller || smtpUser, to: seller, subject, text: body })
      return { success: true }
    }
    throw new Error('SMTP not configured')
  } catch (err) {
    if (seller) {
      const mailto = `mailto:${encodeURIComponent(seller)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      shell.openExternal(mailto)
      return { success: false, error: 'SMTP not configured; opened mail client.' }
    }
    return { success: false, error: 'Seller email not configured' }
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

function startBridgeServer() {
  try {
    if (server) return
    server = http.createServer(async (req, res) => {
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
    server.listen(17865, '127.0.0.1')
  } catch (e) {
    console.error('Bridge server failed to start:', e)
  }
}

function stopBridgeServer() {
  try { server?.close() } catch {}
  server = null
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
