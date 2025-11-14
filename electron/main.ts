import { app, BrowserWindow, ipcMain, shell } from 'electron'
// Load environment variables from .env if present (development convenience)
try {
  // Dynamically require without adding type dep; ignore if not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv')
  dotenv.config()
} catch {}
import * as path from 'path'

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Prevent multiple windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 900,
    minHeight: 640,
    icon: path.join(__dirname, '../build/icon.png'),
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
    // Only open dev tools in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools()
    }
  } else {
    // Production: load from dist folder
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  })
}

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

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  app.quit();
})

// Handle payment activation email request
ipcMain.handle('payment:requestActivation', async (_event, payload: { email: string; requestId: string }) => {
  const seller = process.env.SELLER_EMAIL || ''
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
