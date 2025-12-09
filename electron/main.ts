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
let appServer: http.Server | null = null;  // HTTP server for serving the app (production only)
let bridgeServer: http.Server | null = null;  // HTTP server for extension bridge (all modes)
const APP_SERVER_PORT_BASE = 27649;
let appServerPort = APP_SERVER_PORT_BASE;
const APP_SERVER_MAX_RETRIES = 5;

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
  // Query localStorage to check premium status
  let isPremium = false
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript('localStorage.getItem("passgen-premium")').then(result => {
      // Just rebuild menu after checking
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: 'File',
          submenu: [
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
              label: 'Check for Updates',
              click: () => { checkForUpdates(false) }
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
          click: () => { checkForUpdates(false) }
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
    icon: resolveIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      partition: 'persist:passgen'
    }
  })
  mainWindow.center()

  // In development, use the Vite dev server
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(devServerUrl)
  } else {
    // Production: use local HTTP server to enable WebAuthn (secure context)
    // appServer should be started in app.whenReady() before creating window
    mainWindow.loadURL(`http://127.0.0.1:${appServerPort}`)
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
    console.log(`[WINDOW] App finished loading at http://127.0.0.1:${appServerPort}`)
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

  // Configure persistent session for localStorage preservation
  // Note: partition: 'persist:passgen' in BrowserWindow webPreferences
  // automatically persists localStorage to disk in app userData directory

  app.whenReady().then(async () => {
    // Start app server in production before creating window
    const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL
    if (!isDev) {
      await startAppServer()
    }
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

function startAppServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (appServer) {
        resolve()
        return
      }
      
      const distPath = path.join(__dirname, '../dist')
      const fs = require('fs')
      const storageDir = path.join(app.getPath('userData'), 'Partitions', 'persist:passgen')
      
      // Ensure storage directory exists
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true })
        console.log('[APP SERVER] Created storage directory:', storageDir)
      }

      const createHandler = () => {
        return http.createServer((req, res) => {
          console.log('[APP SERVER] Request:', req.method, req.url)
          try {
            // Parse URL
            let urlPath = req.url || '/'
            if (urlPath.startsWith('?')) urlPath = '/'
            // Default to index.html for root
            let filePath = urlPath === '/' ? path.join(distPath, 'index.html') : path.join(distPath, urlPath)
            // Security: prevent directory traversal
            const realPath = require('path').resolve(filePath)
            if (!realPath.startsWith(require('path').resolve(distPath))) {
              res.writeHead(403, { 'Content-Type': 'text/plain' })
              res.end('403 Forbidden')
              return
            }
            // Try to serve the file
            fs.stat(filePath, (err, stats) => {
              if (err || !stats.isFile()) {
                // File not found, serve index.html for SPA routing
                fs.readFile(path.join(distPath, 'index.html'), (err, content) => {
                  if (!err) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                    res.end(content)
                  } else {
                    console.error('[APP SERVER] Failed to serve index.html:', err)
                    res.writeHead(404, { 'Content-Type': 'text/plain' })
                    res.end('404 Not Found')
                  }
                })
                return
              }
              // File exists, serve it with appropriate MIME type
              const ext = path.extname(filePath).toLowerCase()
              const mimeTypes = {
                '.html': 'text/html; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf'
              }
              const contentType = mimeTypes[ext] || 'application/octet-stream'
              res.writeHead(200, { 'Content-Type': contentType })
              const stream = fs.createReadStream(filePath)
              stream.on('error', (e) => {
                console.error('[APP SERVER] Error streaming file', filePath, e)
                res.writeHead(500, { 'Content-Type': 'text/plain' })
                res.end('500 Internal Server Error')
              })
              stream.pipe(res)
            })
          } catch (e) {
            console.error('[APP SERVER] Unexpected error:', e)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('500 Internal Server Error')
          }
        })
      }

      const tryListen = (attempt: number) => {
        if (attempt > APP_SERVER_MAX_RETRIES) {
          reject(new Error('Failed to bind HTTP server after retries'))
          return
        }
        appServer = createHandler()
        appServer.once('error', (err: any) => {
          console.error('[APP SERVER] Server error:', err)
          if (err.code === 'EADDRINUSE') {
            appServerPort += 1
            console.log(`[APP SERVER] Port in use, retrying on ${appServerPort} (attempt ${attempt + 1}/${APP_SERVER_MAX_RETRIES})`)
            tryListen(attempt + 1)
          } else {
            reject(err)
          }
        })

        appServer.listen(appServerPort, '127.0.0.1', () => {
          console.log(`[APP SERVER] Listening on http://127.0.0.1:${appServerPort}`)
          console.log('[APP SERVER] userData path:', app.getPath('userData'))
          console.log('[APP SERVER] Partition storage dir:', storageDir)
          console.log('[APP SERVER] Storage exists:', fs.existsSync(storageDir))
          console.log('[APP SERVER] distPath:', distPath)
          console.log('[APP SERVER] index.html exists:', fs.existsSync(path.join(distPath, 'index.html')))
          resolve()
        })
      }

      tryListen(1)
    } catch (e) {
      console.error('[APP SERVER] Failed to start:', e)
      reject(e)
    }
  })
}

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
