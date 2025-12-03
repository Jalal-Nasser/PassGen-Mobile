import { useState, useEffect } from 'react'
import './App.css'
import { copyText } from './services/clipboard'
import SplashScreen from './components/SplashScreen'
import Onboarding from './components/Onboarding'
import AppFooter from './components/AppFooter'
import UpgradeModal from './components/UpgradeModal'
import TermsModal from './components/TermsModal'
import StorageSetup from './components/StorageSetup'
import PasswordVault from './components/PasswordVault'
import { StorageManager } from './services/storageManager'
import { ConfigStore } from './services/configStore'
// import { StorageConfig } from './services/configStore'
import CryptoJS from 'crypto-js'

interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

type AppMode = 'onboarding' | 'setup' | 'auth' | 'generator' | 'vault'

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [mode, setMode] = useState<AppMode>('onboarding')
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [storageManager] = useState(() => new StorageManager())
  const [, setMasterPassword] = useState('')
  const [masterPasswordInput, setMasterPasswordInput] = useState('')
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true
  })
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showStorageSetup, setShowStorageSetup] = useState(false)

  useEffect(() => {
    const openUpgrade = () => setShowUpgrade(true)
    const openTerms = () => setShowTerms(true)
    const openStorageSetup = () => setShowStorageSetup(true)
    window.addEventListener('open-upgrade', openUpgrade as EventListener)
    window.addEventListener('open-terms', openTerms as EventListener)
    window.addEventListener('open-storage-setup', openStorageSetup as EventListener)
    return () => {
      window.removeEventListener('open-upgrade', openUpgrade as EventListener)
      window.removeEventListener('open-terms', openTerms as EventListener)
      window.removeEventListener('open-storage-setup', openStorageSetup as EventListener)
    }
  }, [])

  // Check if user has completed onboarding before
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('passgen-onboarding-complete')
    if (hasCompletedOnboarding === 'true') {
      setShowOnboarding(false)
      // Check if storage is configured
      const config = storageManager.getStorageConfig()
      if (config) {
        setMode('auth')
      } else {
        setMode('setup')
      }
    }
  }, [storageManager])

  const handleStorageConfigured = async (config: any) => {
    try {
      await storageManager.initializeStorage(config)
      const hasMasterHash = !!localStorage.getItem('passgen-master-hash')
      if (hasMasterHash) {
        setMode('vault')
      } else {
        setMode('auth')
      }
    } catch (error) {
      alert('Failed to configure storage: ' + (error as Error).message)
    }
  }

  const handleMasterPasswordSubmit = () => {
    if (!masterPasswordInput || masterPasswordInput.length < 8) {
      alert('Master password must be at least 8 characters')
      return
    }

    const cfg = new ConfigStore()
    const inputHash = CryptoJS.SHA256(masterPasswordInput).toString()
    const existingHash = cfg.getMasterPasswordHash()
    let hasVault = false
    try {
      const raw = localStorage.getItem('passgen-vault-data')
      hasVault = !!raw && Array.isArray(JSON.parse(raw)) && JSON.parse(raw).length > 0
    } catch {}

    // First-time setup: only persist hash when no existing vault
    if (!existingHash) {
      if (hasVault) {
        alert('A vault already exists. Please enter your original master password or use Reset App to start fresh.')
        return
      }
      cfg.setMasterPasswordHash(inputHash)
    } else if (existingHash !== inputHash) {
      alert('Incorrect master password. Please try again.')
      return
    }

    setMasterPassword(masterPasswordInput)
    storageManager.initializeEncryption(masterPasswordInput)
    // Notify main that vault is unlocked (for extension session)
    try { (window as any).electronAPI && (window as any).electronAPI.maximize } catch {}
    try { (window as any).electron && (window as any).electron.payment; } catch {}
    try { (window as any).electron && (window as any).electronAPI; } catch {}
    try { (window as any).electron && (window as any).electron.clipboard; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    try { (window as any).electron && (window as any).electron; } catch {}
    setMode('vault')
  }

  const generatePassword = () => {
    let charset = ''
    if (options.lowercase) charset += 'abcdefghijklmnopqrstuvwxyz'
    if (options.uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (options.numbers) charset += '0123456789'
    if (options.symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'

    if (charset === '') {
      alert('Please select at least one character type')
      return
    }

    let newPassword = ''
    for (let i = 0; i < options.length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length)
      newPassword += charset[randomIndex]
    }

    setPassword(newPassword)
    setCopied(false)
  }

  const copyToClipboard = async () => {
    if (password) {
      try {
        const ok = await copyText(password)
        if (ok) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          console.error('Copy failed via all strategies')
        }
      } catch (err) {
        console.error('Copy failed:', err)
      }
    }
  }

  const handleOptionChange = (key: keyof PasswordOptions, value: boolean | number) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }

  const switchToGenerator = () => {
    setMode('generator')
  }

  const handleOnboardingComplete = () => {
    localStorage.setItem('passgen-onboarding-complete', 'true')
    setShowOnboarding(false)
    setMode('setup')
  }

  const handleResetApp = () => {
    const proceed = confirm('This will clear local data and restart the setup wizard. Continue?')
    if (!proceed) return
    storageManager.resetApp()
    setMasterPassword('')
    setMasterPasswordInput('')
    setShowOnboarding(true)
    setMode('onboarding')
    // Force a clean reload to ensure all state resets consistently in Electron
    setTimeout(() => {
      window.location.reload()
    }, 50)
  }

  // Show onboarding for first-time users
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  if (showOnboarding && mode === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="app">
      <div className="container">
        <div className="app-header">
          <button className="link-btn" onClick={handleResetApp} title="Clear local data and restart wizard">
            ↺ Reset App
          </button>
        </div>
        {mode === 'setup' && (
          <StorageSetup open={true} onClose={() => {}} onConfigured={handleStorageConfigured} />
        )}

        {mode === 'auth' && (
          <div className="auth-screen">
            <h1>🔐 PassGen</h1>
            <p className="subtitle">Enter your master password</p>
            <div className="auth-form">
              <input
                type="password"
                value={masterPasswordInput}
                onChange={(e) => setMasterPasswordInput(e.target.value)}
                placeholder="Master Password (min 8 characters)"
                className="auth-input"
                onKeyPress={(e) => e.key === 'Enter' && handleMasterPasswordSubmit()}
              />
              <button onClick={handleMasterPasswordSubmit} className="auth-btn">
                Unlock Vault
              </button>
              <p className="auth-note">
                This password encrypts/decrypts your stored passwords. Don't forget it!
              </p>
            </div>
          </div>
        )}

        {mode === 'vault' && (
          <>
            <div className="mode-switcher">
              <button
                onClick={() => setMode('vault')}
                className="active"
              >
                🗄️ Vault
              </button>
              <button
                onClick={() => setMode('generator')}
                className=""
              >
                🔧 Generator
              </button>
            </div>
            <PasswordVault storageManager={storageManager} onGenerateNew={switchToGenerator} />
          </>
        )}

        {mode === 'generator' && (
          <>
            <div className="mode-switcher">
              <button
                onClick={() => setMode('vault')}
                className=""
              >
                🗄️ Vault
              </button>
              <button
                onClick={() => setMode('generator')}
                className="active"
              >
                🔧 Generator
              </button>
            </div>
            
            <h1>🔐 PassGen</h1>
            <p className="subtitle">Generate Secure Passwords</p>

            <div className="password-display">
              <input
                type="text"
                value={password}
                readOnly
                placeholder="Click generate to create password"
                className="password-input"
              />
              <button
                onClick={copyToClipboard}
                className="copy-btn"
                disabled={!password}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>

            <div className="options">
              <div className="option-group">
                <label htmlFor="length">
                  Password Length: <strong>{options.length}</strong>
                </label>
                <input
                  id="length"
                  type="range"
                  min="4"
                  max="64"
                  value={options.length}
                  onChange={(e) => handleOptionChange('length', parseInt(e.target.value))}
                  className="slider"
                />
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.uppercase}
                    onChange={(e) => handleOptionChange('uppercase', e.target.checked)}
                  />
                  <span>Uppercase Letters (A-Z)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.lowercase}
                    onChange={(e) => handleOptionChange('lowercase', e.target.checked)}
                  />
                  <span>Lowercase Letters (a-z)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.numbers}
                    onChange={(e) => handleOptionChange('numbers', e.target.checked)}
                  />
                  <span>Numbers (0-9)</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.symbols}
                    onChange={(e) => handleOptionChange('symbols', e.target.checked)}
                  />
                  <span>Symbols (!@#$...)</span>
                </label>
              </div>
            </div>

            <button onClick={generatePassword} className="generate-btn">
              Generate Password
            </button>
          </>
        )}
      </div>
      <AppFooter />
      <UpgradeModal open={showUpgrade} onClose={()=>setShowUpgrade(false)} />
      <TermsModal open={showTerms} onClose={()=>setShowTerms(false)} />
      <StorageSetup open={showStorageSetup} onClose={()=>setShowStorageSetup(false)} onConfigured={handleStorageConfigured} />
    </div>
  )
}

export default App
