import { app, BrowserWindow, ipcMain, shell, Menu, dialog, clipboard, protocol, safeStorage, Tray, nativeImage, screen } from 'electron'
import { execSync } from 'child_process'
import Store from 'electron-store'
import * as http from 'http'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
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
let appServer: http.Server | null = null; // Local app server for WebAuthn-safe origin
let appServerReady = false;
let tray: Tray | null = null;
let isQuitting = false;
let aboutWindow: BrowserWindow | null = null;
let updateWindow: BrowserWindow | null = null;
const isStoreBuild = process.env.STORE_BUILD === '1' || process.windowsStore === true;

type AppSettings = {
  minimizeToTray: boolean
}

const appSettingsStore = new Store<AppSettings>({
  name: 'passgen-app-settings',
  defaults: {
    minimizeToTray: true
  }
})
const APP_SERVER_PORT = Number(process.env.PASSGEN_APP_SERVER_PORT) || 17864;
const vaultRepository = new VaultRepository()
const PASSKEY_SERVICE = 'passgen-vault-key'
const PASSKEY_KEY_FILE = path.join(app.getPath('userData'), 'passkey.key')
let keytarModule: any | null | undefined

function getKeytarModule(): any | null {
  if (keytarModule !== undefined) return keytarModule
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    keytarModule = require('keytar')
  } catch {
    keytarModule = null
  }
  return keytarModule
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function safeExec(command: string): string | null {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return null
  }
}

function readBuildInfo(): { commit?: string; commitFull?: string; date?: string } | null {
  const candidates = [
    path.join(process.resourcesPath || '', 'build-info.json'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'build-info.json'),
    path.join(process.cwd(), 'resources', 'build-info.json'),
    path.join(process.cwd(), 'build-info.json')
  ]
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8'))
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {
      // ignore invalid build info
    }
  }
  return null
}

function getCommitInfo(): { commit: string; commitFull: string; date: string } {
  const buildInfo = readBuildInfo()
  const envCommit =
    process.env.PASSGEN_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.GIT_COMMIT ||
    ''
  const commitFull = buildInfo?.commitFull || buildInfo?.commit || envCommit || safeExec('git rev-parse HEAD') || ''
  const commit = commitFull ? commitFull.slice(0, 12) : (buildInfo?.commit || 'unknown')
  const envDate =
    process.env.PASSGEN_BUILD_DATE ||
    process.env.VERCEL_GIT_COMMIT_DATE ||
    process.env.BUILD_DATE ||
    ''
  const date = buildInfo?.date || envDate || safeExec('git log -1 --format=%cI') || ''
  return { commit, commitFull: commitFull || 'unknown', date }
}

function formatRelativeDate(dateText: string): string | null {
  const parsed = Date.parse(dateText)
  if (Number.isNaN(parsed)) return null
  const diffMs = Date.now() - parsed
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return 'today'
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 8) return `${diffWeeks} wk${diffWeeks === 1 ? '' : 's'} ago`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths} mo${diffMonths === 1 ? '' : 's'} ago`
}

function getAboutInfo() {
  const version = app.getVersion()
  const commitInfo = getCommitInfo()
  const dateLabel = commitInfo.date
  const relative = commitInfo.date ? formatRelativeDate(commitInfo.date) : null
  const dateLine = dateLabel ? `${dateLabel}${relative ? ` (${relative})` : ''}` : 'unknown'
  const platformLabel = process.platform === 'win32' ? 'Windows_NT' : process.platform === 'darwin' ? 'Darwin' : 'Linux'
  const osLabel = `${platformLabel} ${process.arch} ${os.release()}`
  const languageServerCl = process.env.PASSGEN_LS_CL || ''
  return {
    appVersion: version,
    commit: commitInfo.commit,
    commitFull: commitInfo.commitFull,
    date: dateLine,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
    os: osLabel,
    languageServerCl
  }
}

function buildAboutHtml() {
  const info = getAboutInfo()
  const iconUrl = getInlineAppIconUrl()
  const rows = [
    ['PassGen Version', info.appVersion],
    ['Commit', info.commit],
    ['Date', info.date],
    ['Electron', info.electron],
    ['Chromium', info.chromium],
    ['Node.js', info.node],
    ['V8', info.v8],
    ['OS', info.os]
  ]
  if (info.languageServerCl) {
    rows.push(['Language Server CL', info.languageServerCl])
  }
  const rowHtml = rows.map(([label, value]) => `
    <div class="row">
      <span class="label">${label}:</span>
      <span class="value">${value || 'unknown'}</span>
    </div>
  `).join('')
  const copyText = rows.map(([label, value]) => `${label}: ${value || 'unknown'}`).join('\n')
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>About PassGen</title>
    <style>
      body {
        margin: 0;
        font-family: "Segoe UI", "Inter", sans-serif;
        background: #f5f3ff;
        color: #1f2937;
        overflow: hidden;
      }
      .frame {
        margin: 14px;
        border-radius: 16px;
        padding: 16px 18px 14px;
        border: 1px solid rgba(196, 181, 253, 0.9);
        box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.18), 0 16px 32px rgba(76, 29, 149, 0.18);
        background: linear-gradient(160deg, #ffffff, #ede9fe);
      }
      .header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(139, 92, 246, 0.12);
        border: 2px solid rgba(139, 92, 246, 0.5);
        color: #6d28d9;
        font-weight: 700;
        font-size: 18px;
        overflow: hidden;
      }
      .icon img {
        width: 20px;
        height: 20px;
        object-fit: contain;
      }
      h1 {
        font-size: 18px;
        margin: 0;
        font-weight: 700;
        color: #312e81;
      }
      .rows {
        display: grid;
        gap: 5px;
        font-size: 13px;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: baseline;
      }
      .label {
        min-width: 150px;
        color: #4c1d95;
        font-weight: 700;
      }
      .value {
        color: #1f2937;
        word-break: break-all;
      }
      .actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
      }
      button {
        padding: 8px 14px;
        border-radius: 10px;
        border: 1px solid transparent;
        cursor: pointer;
        font-weight: 700;
        background: linear-gradient(130deg, #6d28d9, #8b5cf6);
        color: #ffffff;
        box-shadow: 0 10px 22px rgba(109, 40, 217, 0.25);
      }
      button.secondary {
        background: #f5f3ff;
        border: 1px solid rgba(139, 92, 246, 0.4);
        color: #5b21b6;
        box-shadow: none;
      }
      .link-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="header">
        <div class="icon">${iconUrl ? `<img src="${iconUrl}" alt="PassGen" />` : 'i'}</div>
        <h1>PassGen</h1>
      </div>
      <div class="rows">
        ${rowHtml}
      </div>
      <div class="actions">
        <div class="link-row">
          <button class="secondary" data-href="${HELP_WEBSITE_URL}">Website</button>
          <button class="secondary" data-href="${HELP_RELEASES_URL}">GitHub</button>
          <button class="secondary" data-href="${HELP_ISSUES_URL}">Support</button>
          <button class="secondary" data-href="${HELP_PRIVACY_URL}">Privacy Policy</button>
        </div>
        <div class="link-row">
          <button class="secondary" id="copyBtn">Copy</button>
          <button id="okBtn">OK</button>
        </div>
      </div>
    </div>
    <script>
      const text = ${JSON.stringify(copyText)};
      const copy = async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return;
          }
        } catch {}
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.focus();
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      };
      document.getElementById('copyBtn').addEventListener('click', copy);
      document.getElementById('okBtn').addEventListener('click', () => window.close());
      document.querySelectorAll('[data-href]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-href');
          if (url) window.open(url, '_blank');
        });
      });
    </script>
  </body>
</html>`
}

function buildUpdateHtml(tag: string, url: string) {
  const iconUrl = getInlineAppIconUrl()
  const safeUrl = url || ''
  const safeTag = tag || ''
  const downloadDisabled = !safeUrl
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Update Available</title>
    <style>
      body {
        margin: 0;
        font-family: "Segoe UI", "Inter", sans-serif;
        background: transparent;
        color: #1f2937;
      }
      .toast {
        margin: 10px;
        border-radius: 16px;
        padding: 14px 16px;
        border: 1px solid rgba(196, 181, 253, 0.7);
        background: linear-gradient(135deg, #ffffff, #ede9fe);
        box-shadow: 0 20px 40px rgba(76, 29, 149, 0.25);
      }
      .header {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .icon {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(139, 92, 246, 0.14);
        border: 1px solid rgba(139, 92, 246, 0.45);
        overflow: hidden;
      }
      .icon img {
        width: 22px;
        height: 22px;
        object-fit: contain;
      }
      h1 {
        font-size: 16px;
        margin: 0;
        font-weight: 700;
        color: #312e81;
      }
      .subtitle {
        margin: 8px 0 10px;
        color: #4c1d95;
        font-size: 12.5px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
      }
      button {
        padding: 7px 12px;
        border-radius: 10px;
        border: 1px solid transparent;
        cursor: pointer;
        font-weight: 700;
        background: linear-gradient(130deg, #6d28d9, #8b5cf6);
        color: #ffffff;
        box-shadow: 0 10px 18px rgba(109, 40, 217, 0.22);
      }
      button.secondary {
        background: transparent;
        border: 1px solid rgba(139, 92, 246, 0.35);
        color: #5b21b6;
        box-shadow: none;
      }
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        box-shadow: none;
      }
    </style>
  </head>
  <body>
    <div class="toast">
      <div class="header">
        <div class="icon">${iconUrl ? `<img src="${iconUrl}" alt="PassGen" />` : '!'}</div>
        <h1>Update Available</h1>
      </div>
      <div class="subtitle">A new version ${safeTag || 'is available'} is ready to download.</div>
      <div class="actions">
        <button id="downloadBtn" ${downloadDisabled ? 'disabled' : ''}>Download</button>
        <button class="secondary" id="laterBtn">Later</button>
      </div>
    </div>
    <script>
      const url = ${JSON.stringify(safeUrl)};
      const downloadBtn = document.getElementById('downloadBtn');
      const laterBtn = document.getElementById('laterBtn');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          if (url) window.open(url, '_blank');
          window.close();
        });
      }
      if (laterBtn) {
        laterBtn.addEventListener('click', () => window.close());
      }
    </script>
  </body>
</html>`
}

function getInlineAppIconUrl(): string {
  const iconCandidates = [
    path.join(process.cwd(), 'public', 'icon.png'),
    path.join(process.cwd(), 'dist', 'icon.png'),
    resolveIconPath()
  ].filter(Boolean) as string[]
  const iconPath = iconCandidates.find((candidate) => candidate && fs.existsSync(candidate)) || ''
  if (!iconPath) return ''
  try {
    const iconData = fs.readFileSync(iconPath)
    return `data:image/png;base64,${iconData.toString('base64')}`
  } catch {
    return ''
  }
}

function getMinimizeToTraySetting(): boolean {
  return appSettingsStore.get('minimizeToTray') !== false
}

function getTrayIconPath(): string | null {
  const candidates = [
    path.join(app.getAppPath(), 'dist', 'icon.png'),
    path.join(app.getAppPath(), 'public', 'icon.png'),
    path.join(process.cwd(), 'dist', 'icon.png'),
    path.join(process.cwd(), 'public', 'icon.png'),
    path.join(process.cwd(), 'build', 'icon.png')
  ]
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  return null
}

function showFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.show()
  mainWindow.setSkipTaskbar(false)
  mainWindow.focus()
}

function createTray(): boolean {
  if (tray) return true
  const iconPath = getTrayIconPath()
  if (!iconPath) {
    console.warn('[TRAY] icon not found, tray disabled')
    return false
  }
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)
  tray.setToolTip('PassGen')
  tray.on('click', showFromTray)
  tray.on('double-click', showFromTray)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show PassGen', click: showFromTray },
    { label: 'Minimize to Tray', click: () => minimizeToTray() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]))
  return true
}

function minimizeToTray(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  const created = createTray()
  if (!created || !tray) return false
  mainWindow.hide()
  mainWindow.setSkipTaskbar(true)
  return true
}

async function storePasskeyVaultKey(installId: string): Promise<void> {
  const key = vaultRepository.getDerivedKey()
  if (!key) {
    throw new Error('Vault is locked')
  }
  const keytar = getKeytarModule()
  if (keytar) {
    await keytar.setPassword(PASSKEY_SERVICE, installId, key.toString('base64'))
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is unavailable. Install keytar to enable passkey unlock.')
  }
  const encrypted = safeStorage.encryptString(key.toString('base64'))
  const payload = JSON.stringify({
    installId,
    key: encrypted.toString('base64')
  })
  await fs.promises.writeFile(PASSKEY_KEY_FILE, payload, 'utf8')
}

async function loadPasskeyVaultKey(installId: string): Promise<Buffer> {
  const keytar = getKeytarModule()
  if (keytar) {
    const stored = await keytar.getPassword(PASSKEY_SERVICE, installId)
    if (stored) {
      return Buffer.from(stored, 'base64')
    }
    const credentials = await keytar.findCredentials(PASSKEY_SERVICE)
    if (credentials && credentials.length > 0) {
      const fallback = credentials[0]
      if (fallback?.password) {
        await keytar.setPassword(PASSKEY_SERVICE, installId, fallback.password)
        if (fallback.account && fallback.account !== installId) {
          try {
            await keytar.deletePassword(PASSKEY_SERVICE, fallback.account)
          } catch {}
        }
        return Buffer.from(fallback.password, 'base64')
      }
    }
    throw new Error('Passkey unlock is not enabled on this device')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is unavailable. Install keytar to enable passkey unlock.')
  }
  let raw = ''
  try {
    raw = await fs.promises.readFile(PASSKEY_KEY_FILE, 'utf8')
  } catch {
    throw new Error('Passkey unlock is not enabled on this device')
  }
  let parsed: { installId?: string; key?: string } = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Passkey unlock is not enabled on this device')
  }
  if (!parsed.key) {
    throw new Error('Passkey unlock is not enabled on this device')
  }
  const encrypted = Buffer.from(parsed.key, 'base64')
  const decrypted = safeStorage.decryptString(encrypted)
  if (parsed.installId !== installId) {
    const payload = JSON.stringify({
      installId,
      key: parsed.key
    })
    try {
      await fs.promises.writeFile(PASSKEY_KEY_FILE, payload, 'utf8')
    } catch {}
  }
  return Buffer.from(decrypted, 'base64')
}

async function clearPasskeyVaultKey(installId: string): Promise<void> {
  const keytar = getKeytarModule()
  if (keytar) {
    try {
      await keytar.deletePassword(PASSKEY_SERVICE, installId)
    } catch {}
    return
  }
  if (!safeStorage.isEncryptionAvailable()) return
  try {
    const raw = await fs.promises.readFile(PASSKEY_KEY_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.installId !== installId) return
    await fs.promises.unlink(PASSKEY_KEY_FILE)
  } catch {}
}
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

const HELP_DOCS_URL = 'https://github.com/mDeploys/PassGen'
const HELP_ISSUES_URL = 'https://github.com/mDeploys/PassGen/issues'
const HELP_RELEASES_URL = 'https://github.com/mDeploys/PassGen/releases'
const HELP_WEBSITE_URL = 'https://mdeploy.dev'
const HELP_TERMS_URL = 'https://github.com/mDeploys/PassGen/blob/main/LICENSE.txt'
const HELP_PRIVACY_URL = 'https://passgen.mdeploy.dev/privacy'
const KEYBOARD_SHORTCUTS_DETAIL =
  'Ctrl+C - Copy password\nCtrl+L - Lock vault\nCtrl+N - New password entry\nCtrl+F - Search vault\nCtrl+Q - Quit application\nF5 - Refresh\nF11 - Toggle fullscreen'

const AUTH_PROTOCOL = 'passgen'
const APP_PROTOCOL = 'passgen-app'

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
])

function registerAppProtocol() {
  const distRoot = path.join(__dirname, '../dist')
  protocol.registerFileProtocol(APP_PROTOCOL, (request, callback) => {
    try {
      const requestUrl = new URL(request.url)
      let pathname = decodeURIComponent(requestUrl.pathname || '')
      if (!pathname || pathname === '/') pathname = '/index.html'
      const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '')
      const filePath = path.join(distRoot, safePath)
      callback({ path: filePath })
    } catch {
      callback({ path: path.join(distRoot, 'index.html') })
    }
  })
}

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
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus()
    return
  }
  aboutWindow = new BrowserWindow({
    width: 520,
    height: 420,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: 'About PassGen',
    icon: resolveIconPath(),
    backgroundColor: '#0b1f3a',
    parent: mainWindow || undefined,
    modal: !!mainWindow,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })
  aboutWindow.once('ready-to-show', () => aboutWindow?.show())
  aboutWindow.on('closed', () => {
    aboutWindow = null
  })
  aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url && /^https?:\/\//i.test(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  aboutWindow.webContents.on('will-navigate', (event, url) => {
    if (url && url.startsWith('data:')) return
    event.preventDefault()
    if (url && /^https?:\/\//i.test(url)) {
      shell.openExternal(url)
    }
  })
  const html = buildAboutHtml()
  aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
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
            { label: 'Minimize to Tray', click: minimizeToTray },
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
            ...(!isStoreBuild ? [
              {
                label: 'Check for Updates',
                click: () => { checkForUpdates(false) }
              },
              {
                label: 'GitHub Releases',
                click: openReleases
              }
            ] : []),
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
        { label: 'Minimize to Tray', click: minimizeToTray },
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
        ...(!isStoreBuild ? [
          {
            label: 'Check for Updates',
            click: () => { checkForUpdates(false) }
          },
          {
            label: 'GitHub Releases',
            click: openReleases
          }
        ] : []),
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
  if (isStoreBuild) {
    return
  }
  try {
    const current = app.getVersion().replace(/^v/, '')
    const js = `(
      async () => {
        // Fetch latest release from the main PassGen repo
        const res = await fetch('https://api.github.com/repos/mDeploys/PassGen/releases/latest');
        const data = await res.json();
        return { tag: (data.tag_name||'').replace(/^v/, ''), url: data.html_url||'' }
      }
    )()`
    const { tag, url } = await (mainWindow?.webContents.executeJavaScript(js).catch(()=>({tag:'',url:''})) || Promise.resolve({tag:'',url:''}))
    if (tag && isNewer(tag, current)) {
      showUpdateDialog(tag, url)
    } else if (!silent) {
      dialog.showMessageBox({ type: 'info', title: 'PassGen', message: 'You have the latest version.' })
    }
  } catch (e) {
    if (!silent) dialog.showMessageBox({ type: 'warning', title: 'Update Check Failed', message: String((e as Error).message||e) })
  }
}

function showUpdateDialog(tag: string, url: string) {
  if (isStoreBuild) {
    return
  }
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.focus()
    return
  }
  updateWindow = new BrowserWindow({
    width: 360,
    height: 150,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    title: 'Update Available',
    icon: resolveIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })
  updateWindow.setMenuBarVisibility(false)
  updateWindow.setMenu(null)
  updateWindow.once('ready-to-show', () => {
    if (!updateWindow) return
    const { width, height } = updateWindow.getBounds()
    const { workArea } = screen.getPrimaryDisplay()
    const x = Math.max(workArea.x, workArea.x + workArea.width - width - 16)
    const y = Math.max(workArea.y, workArea.y + workArea.height - height - 16)
    updateWindow.setPosition(x, y, false)
    updateWindow.showInactive()
  })
  updateWindow.on('closed', () => {
    updateWindow = null
  })
  updateWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl)
    return { action: 'deny' }
  })
  updateWindow.webContents.on('will-navigate', (event, navUrl) => {
    event.preventDefault()
    shell.openExternal(navUrl)
  })
  const html = buildUpdateHtml(tag, url)
  updateWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
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
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL

  const forceFileInDev = process.env.PASSGEN_USE_FILE_DEV === 'true'
  const useAppServer = (!isDev || process.env.PASSGEN_USE_APP_SERVER === 'true') && appServerReady
  if (useAppServer) {
    const appUrl = `http://localhost:${APP_SERVER_PORT}/index.html`
    mainWindow.loadURL(appUrl)
  } else if (isDev && !forceFileInDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(devServerUrl)
  } else {
    const appUrl = `${APP_PROTOCOL}://localhost/index.html`
    mainWindow.loadURL(appUrl)
  }

  mainWindow.on('minimize', (event) => {
    if (isQuitting) return
    if (!getMinimizeToTraySetting()) return
    const hidden = minimizeToTray()
    if (hidden) event.preventDefault()
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    if (!getMinimizeToTraySetting()) return
    const hidden = minimizeToTray()
    if (hidden) event.preventDefault()
  })

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

  mainWindow.webContents.once('did-finish-load', () => {
    migrateLegacyLocalStorage().catch((error) => {
      console.warn('[MIGRATION] Failed:', (error as Error).message || error)
    })
  })
}

async function migrateLegacyLocalStorage(): Promise<void> {
  if (!mainWindow || !app.isPackaged) return
  const currentUrl = mainWindow.webContents.getURL()
  const isAppScheme = currentUrl.startsWith(`${APP_PROTOCOL}://`)
  const isLocalhost = currentUrl.startsWith(`http://localhost:${APP_SERVER_PORT}`)
  if (!isAppScheme && !isLocalhost) return

  const migrationKey = isLocalhost ? 'passgen-migrated-to-localhost' : 'passgen-migrated-to-app-scheme'
  const hasMigrated = await mainWindow.webContents.executeJavaScript(`
    localStorage.getItem('${migrationKey}') === 'true'
  `)
  if (hasMigrated) return

  const hasAppData = await mainWindow.webContents.executeJavaScript(`
    Object.keys(localStorage).some(k => k.startsWith('passgen-'))
  `)
  if (hasAppData) {
    await mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('${migrationKey}', 'true')
    `)
    return
  }

  const readFromSource = async (loader: (win: BrowserWindow) => Promise<void>): Promise<Record<string, string>> => {
    const legacyWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    })
    try {
      await loader(legacyWindow)
      const legacyData = await legacyWindow.webContents.executeJavaScript(`
        (() => {
          const data = {};
          Object.keys(localStorage)
            .filter(k => k.startsWith('passgen-'))
            .forEach((k) => { data[k] = localStorage.getItem(k); });
          return data;
        })()
      `)
      return legacyData && typeof legacyData === 'object' ? (legacyData as Record<string, string>) : {}
    } finally {
      legacyWindow.destroy()
    }
  }

  const legacyIndex = path.join(__dirname, '../dist/index.html')
  const sources: Array<() => Promise<Record<string, string>>> = [
    () => readFromSource(async (win) => {
      await win.loadFile(legacyIndex)
    }),
    () => readFromSource(async (win) => {
      await win.loadURL(`${APP_PROTOCOL}://localhost/index.html`)
    })
  ]

  let legacyData: Record<string, string> = {}
  for (const load of sources) {
    try {
      legacyData = await load()
    } catch {
      legacyData = {}
    }
    if (Object.keys(legacyData).length > 0) break
  }

  if (Object.keys(legacyData).length > 0) {
    const payload = JSON.stringify(legacyData)
    await mainWindow.webContents.executeJavaScript(`
      (() => {
        const data = ${payload};
        Object.entries(data).forEach(([k, v]) => {
          if (typeof v === 'string') localStorage.setItem(k, v);
        });
        localStorage.setItem('${migrationKey}', 'true');
      })()
    `)
    mainWindow.webContents.reload()
  } else {
    await mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('${migrationKey}', 'true')
    `)
  }
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

ipcMain.handle('app:openExternal', async (_event, url: string) => {
  if (!url || typeof url !== 'string') {
    throw new Error('Missing URL')
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Invalid URL')
  }
  await shell.openExternal(url)
  return { ok: true }
})

ipcMain.handle('settings:get', async () => {
  return {
    minimizeToTray: getMinimizeToTraySetting()
  }
})

ipcMain.handle('settings:set', async (_event, payload: { minimizeToTray?: boolean }) => {
  if (typeof payload?.minimizeToTray === 'boolean') {
    appSettingsStore.set('minimizeToTray', payload.minimizeToTray)
  }
  return {
    minimizeToTray: getMinimizeToTraySetting()
  }
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

  app.whenReady().then(async () => {
    registerAppProtocol()
    const shouldUseAppServer = app.isPackaged || process.env.PASSGEN_USE_APP_SERVER === 'true'
    if (shouldUseAppServer) {
      const started = await startAppServer()
      if (!started) {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Passkey unavailable',
          message: 'Failed to start the local app server. Passkey/Windows Hello may not work.',
          detail: `Port ${APP_SERVER_PORT} is required for passkey support.`,
          buttons: ['OK']
        })
      }
    }
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
    if (!isStoreBuild) {
      // Initial update check and periodic checks every 6 hours
      setTimeout(() => checkForUpdates(true), 5000)
      setInterval(() => checkForUpdates(true), 6 * 60 * 60 * 1000)
    }
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
  stopAppServer()
  app.quit();
})

app.on('before-quit', () => {
  isQuitting = true
  if (tray) {
    tray.destroy()
    tray = null
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

console.log('[DEV SECRET] Registering handler dev-secret:generate')
ipcMain.handle('dev-secret:generate', async () => {
  const bytes = crypto.randomBytes(32)
  return {
    base64Url: toBase64Url(bytes),
    hex: bytes.toString('hex')
  }
})

console.log('[DEV SECRET] Registering handler dev-secret:selectProject')
ipcMain.handle('dev-secret:selectProject', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Project Folder',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false }
  }
  const folder = result.filePaths[0]
  const envPath = path.join(folder, '.env')
  const hasEnv = fs.existsSync(envPath)
  return { success: true, folder, hasEnv, envPath }
})

console.log('[DEV SECRET] Registering handler dev-secret:injectEnv')
ipcMain.handle('dev-secret:injectEnv', async (_event, payload: { folder: string; key: string; value: string }) => {
  const folder = String(payload?.folder || '').trim()
  const key = String(payload?.key || '').trim()
  const value = String(payload?.value || '')
  if (!folder) {
    throw new Error('Missing project folder')
  }
  if (!key) {
    throw new Error('Missing key name')
  }

  const envPath = path.join(folder, '.env')
  let content = ''
  let existed = false
  try {
    content = await fs.promises.readFile(envPath, 'utf8')
    existed = true
  } catch {
    content = ''
  }

  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized ? normalized.split('\n') : []
  if (lines.length && lines[lines.length - 1] === '') {
    lines.pop()
  }

  const matcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`)
  let updated = false
  const nextLines = lines.map((line) => {
    if (matcher.test(line)) {
      updated = true
      return `${key}=${value}`
    }
    return line
  })

  if (!updated) {
    nextLines.push(`${key}=${value}`)
  }

  const output = `${nextLines.join('\n')}\n`
  await fs.promises.writeFile(envPath, output, 'utf8')

  return { success: true, envPath, updated, created: !existed }
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

ipcMain.handle('vault:unlockWithPasskey', async (_event, installId: string) => {
  if (!installId) {
    throw new Error('Missing install id')
  }
  const key = await loadPasskeyVaultKey(installId)
  await vaultRepository.unlockWithKey(key)
  return { ok: true }
})

ipcMain.handle('passkey:storeKey', async (_event, installId: string) => {
  if (!installId) {
    throw new Error('Missing install id')
  }
  await storePasskeyVaultKey(installId)
  return { ok: true }
})

ipcMain.handle('passkey:clearKey', async (_event, installId: string) => {
  if (!installId) {
    throw new Error('Missing install id')
  }
  await clearPasskeyVaultKey(installId)
  return { ok: true }
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

ipcMain.handle('vault:importFromCloud', async (_event, providerId: string, versionId?: string) => {
  await vaultRepository.importFromCloud(providerId as any, versionId)
  return { ok: true }
})

ipcMain.handle('vault:listCloudVersions', async (_event, providerId: string) => {
  return vaultRepository.listCloudVersions(providerId as any)
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

ipcMain.handle('license:redeem', async (_event, payload: { licenseKey: string; deviceId?: string }) => {
  const baseUrl = (() => {
    try {
      return getVercelBaseUrl()
    } catch (error) {
      console.warn('[LICENSE DEBUG] Missing VERCEL_APP_URL:', (error as Error).message)
      return ''
    }
  })()
  if (!baseUrl) {
    throw new Error('VERCEL_APP_URL is not configured')
  }

  const session = await loadDesktopSession(vaultRepository)
  if (!session?.accessToken) {
    throw new Error('Not authenticated / invalid desktop token')
  }

  const requestUrl = `${baseUrl}/api/license/redeem`
  const body = {
    licenseKey: String(payload?.licenseKey || ''),
    deviceId: payload?.deviceId ? String(payload.deviceId) : undefined
  }

  let response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`
    },
    body: JSON.stringify(body)
  })

  if (response.status === 401 && session.refreshToken) {
    const refreshed = await refreshDesktopSession(session)
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshed.accessToken}`
      },
      body: JSON.stringify(body)
    })
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Not authenticated / invalid desktop token')
  }

  const text = await response.text()
  if (!response.ok) {
    throw new Error(text || `License redeem failed (${response.status})`)
  }

  try {
    return JSON.parse(text)
  } catch {
    return { ok: true }
  }
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

ipcMain.handle('storage:supabaseTest', async (_event, config) => {
  return vaultRepository.testSupabaseConnection(config)
})

ipcMain.handle('storage:supabaseUpload', async (_event, config, data: string | Buffer, retainCount: number) => {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data ?? ''), 'utf8')
  return vaultRepository.uploadSupabaseSnapshot(config, payload, retainCount || 10)
})

ipcMain.handle('storage:supabaseDownload', async (_event, config, versionId?: string) => {
  const data = await vaultRepository.downloadSupabaseSnapshot(config, versionId)
  return data.toString('utf8')
})

ipcMain.handle('storage:supabaseListVersions', async (_event, config) => {
  return vaultRepository.listSupabaseVersions(config)
})

ipcMain.handle('storage:supabaseRestoreVersion', async (_event, config, versionId: string) => {
  const data = await vaultRepository.restoreSupabaseVersion(config, versionId)
  return data.toString('utf8')
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

ipcMain.handle('storage:oneDriveConnect', async () => {
  return vaultRepository.connectOneDrive()
})

ipcMain.handle('storage:oneDriveDisconnect', async () => {
  return vaultRepository.disconnectOneDrive()
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
    filters: [{ name: 'Vault Backup', extensions: ['pgvault', 'json'] }],
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
          const credentialId = credential.id;
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
          id: assertion.id,
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

async function startAppServer(): Promise<boolean> {
  if (appServerReady) return true
  return await new Promise((resolve) => {
    try {
      const distRoot = path.join(__dirname, '../dist')
      appServer = http.createServer((req, res) => {
        try {
          if (!req.url) {
            res.writeHead(400)
            res.end('Bad Request')
            return
          }
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405)
            res.end('Method Not Allowed')
            return
          }

          const requestUrl = new URL(req.url, `http://localhost:${APP_SERVER_PORT}`)
          let pathname = decodeURIComponent(requestUrl.pathname || '/')
          if (!pathname || pathname === '/') pathname = '/index.html'
          const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '')
          let filePath = path.join(distRoot, safePath)
          if (!filePath.startsWith(distRoot)) {
            filePath = path.join(distRoot, 'index.html')
          }

          const fallbackToIndex = () => {
            const indexPath = path.join(distRoot, 'index.html')
            fs.readFile(indexPath, (err, data) => {
              if (err) {
                res.writeHead(404)
                res.end('Not Found')
                return
              }
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(req.method === 'HEAD' ? undefined : data)
            })
          }

          fs.stat(filePath, (err, stat) => {
            if (err || !stat.isFile()) {
              fallbackToIndex()
              return
            }
            fs.readFile(filePath, (errRead, data) => {
              if (errRead) {
                fallbackToIndex()
                return
              }
              const ext = path.extname(filePath).toLowerCase()
              const mime =
                ext === '.html' ? 'text/html' :
                ext === '.js' ? 'application/javascript' :
                ext === '.css' ? 'text/css' :
                ext === '.json' ? 'application/json' :
                ext === '.svg' ? 'image/svg+xml' :
                ext === '.png' ? 'image/png' :
                ext === '.ico' ? 'image/x-icon' :
                'application/octet-stream'
              res.writeHead(200, { 'Content-Type': mime })
              res.end(req.method === 'HEAD' ? undefined : data)
            })
          })
        } catch (e) {
          res.writeHead(500)
          res.end('Server Error')
        }
      })

      appServer.on('error', (err) => {
        appServerReady = false
        console.error('[APP SERVER] Failed to start:', err)
        resolve(false)
      })

      appServer.listen(APP_SERVER_PORT, '127.0.0.1', () => {
        appServerReady = true
        resolve(true)
      })
    } catch (e) {
      appServerReady = false
      console.error('[APP SERVER] Failed to start:', e)
      resolve(false)
    }
  })
}

function stopAppServer() {
  try { appServer?.close() } catch {}
  appServer = null
  appServerReady = false
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
