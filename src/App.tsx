import { useState, useEffect, useRef } from 'react'
import './App.css'
import { copyText } from './services/clipboard'
import SplashScreen from './components/SplashScreen'
import Onboarding from './components/Onboarding'
import AppFooter from './components/AppFooter'
import UpgradeModal from './components/UpgradeModal'
import TermsModal from './components/TermsModal'
import StorageSetup from './components/StorageSetup'
import PasswordVault from './components/PasswordVault'
import { CustomTitleBar } from './components/CustomTitleBar'
import { StorageManager } from './services/storageManager'
import { ConfigStore } from './services/configStore'
import { applyRemoteLicense, getPremiumTier } from './services/license'
import { useI18n } from './services/i18n'
import SettingsModal from './components/SettingsModal'
import DeveloperTab from './components/DeveloperTab'

interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

type AppMode = 'onboarding' | 'setup' | 'auth' | 'generator' | 'vault' | 'developer'

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [mode, setMode] = useState<AppMode>('onboarding')
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [storageManager] = useState(() => new StorageManager())
  const [, setMasterPassword] = useState('')
  const [masterPasswordInput, setMasterPasswordInput] = useState('')
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [hasVault, setHasVault] = useState(false)
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
  const [showSettings, setShowSettings] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordHint, setPasswordHint] = useState('')
  const [passwordHintInput, setPasswordHintInput] = useState('')
  const [passkeyNotice, setPasskeyNotice] = useState<string | null>(null)
  const [premiumTier, setPremiumTier] = useState(getPremiumTier())
  const isPremium = premiumTier !== 'free'
  const { t, isRTL } = useI18n()
  const masterPasswordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const openUpgrade = () => setShowUpgrade(true)
    const openTerms = () => setShowTerms(true)
    const openStorageSetup = () => setShowStorageSetup(true)
    const openSettings = () => setShowSettings(true)
    window.addEventListener('open-upgrade', openUpgrade as EventListener)
    window.addEventListener('open-terms', openTerms as EventListener)
    window.addEventListener('open-storage-setup', openStorageSetup as EventListener)
    window.addEventListener('open-settings', openSettings as EventListener)
    return () => {
      window.removeEventListener('open-upgrade', openUpgrade as EventListener)
      window.removeEventListener('open-terms', openTerms as EventListener)
      window.removeEventListener('open-storage-setup', openStorageSetup as EventListener)
      window.removeEventListener('open-settings', openSettings as EventListener)
    }
  }, [])

  useEffect(() => {
    const handlePremiumChange = () => setPremiumTier(getPremiumTier())
    window.addEventListener('premium-changed', handlePremiumChange)
    return () => window.removeEventListener('premium-changed', handlePremiumChange)
  }, [])

  useEffect(() => {
    const api = (window as any).nativeBridgeAPI
    if (!api?.licenseGetMe) return
    let cancelled = false

    const syncLicense = async () => {
      try {
        const me = await api.licenseGetMe()
        if (!cancelled) applyRemoteLicense(me)
      } catch (error) {
        console.warn('License sync failed:', (error as Error).message)
      }
    }

    syncLicense()

    const unsubscribe = api.onAuthUpdated?.(() => {
      syncLicense()
    })

    return () => {
      cancelled = true
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  // Check if user has completed onboarding before
  // NOTE: Premium status and hints are stored in localStorage; the encrypted vault lives on disk.
  // This ensures no data loss during updates.
  // See DATA_PERSISTENCE.md for details.
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('passgen-onboarding-complete')
    if (hasCompletedOnboarding === 'true') {
      setShowOnboarding(false)
      // Determine whether a vault already exists
      ;(async () => {
        try {
          const status = await storageManager.getVaultStatus()
          setHasVault(status.hasVault)
          setMode(status.hasVault ? 'auth' : 'setup')
        } catch {
          setHasVault(false)
          setMode('setup')
        }
      })()
    }
    // Load password hint
    const savedHint = localStorage.getItem('passgen-password-hint')
    if (savedHint) {
      setPasswordHint(savedHint)
    }
  }, [storageManager])

  const handleStorageConfigured = async (config: any) => {
    try {
      await storageManager.initializeStorage(config)
      setMode((prev) => (prev === 'vault' ? 'vault' : 'auth'))
    } catch (error) {
      alert(t('Failed to configure storage: {{message}}', { message: (error as Error).message }))
    }
  }

  const handleMasterPasswordSubmit = async () => {
    if (!masterPasswordInput || masterPasswordInput.length < 8) {
      alert(t('Master password must be at least 8 characters'))
      return
    }

    try {
      const status = await storageManager.getVaultStatus()
      if (!status.hasVault && passwordHintInput.trim()) {
        localStorage.setItem('passgen-password-hint', passwordHintInput.trim())
        setPasswordHint(passwordHintInput.trim())
      }

      setMasterPassword(masterPasswordInput)
      await storageManager.initializeEncryption(masterPasswordInput)
      setHasVault(true)
      setPasskeyNotice(null)
      const cfg = new ConfigStore()
      if (cfg.getPasskeyCredential()) {
        try {
          await storageManager.storePasskeyKey(cfg.getInstallId())
        } catch (e) {
          console.warn('Passkey key storage failed:', (e as Error).message)
        }
      }
    } catch (error) {
      alert((error as Error).message || t('Incorrect master password. Please try again.'))
      return
    }
    // Notify main that vault is unlocked (for extension session)
    try { (window as any).nativeBridgeAPI?.vaultUnlocked?.() } catch {}
    setMode('vault')
  }

  const handlePasskeyUnlock = async () => {
    try {
      // Check if WebAuthn is supported
      if (!navigator.credentials || !navigator.credentials.get) {
        alert(t('Passkey is not supported on this device'))
        return
      }

      // Check if we're in a secure context and allowed origin
      const protocol = window.location.protocol
      const host = window.location.hostname
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
      const isAllowedOrigin = protocol === 'https:' || (protocol === 'http:' && isLocalhost)
      if (!window.isSecureContext || !isAllowedOrigin) {
        alert(t('Passkey requires a secure context. Please use your master password.'))
        return
      }

      const cfg = new ConfigStore()
      const cred = cfg.getPasskeyCredential()
      if (!cred || !cred.credentialId) {
        alert(t('No passkey found. Please use your master password.'))
        return
      }

      const decodeCredentialId = (value: string): Uint8Array | null => {
        if (!value) return null
        const isHex = /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0
        if (isHex) {
          const bytes = new Uint8Array(value.length / 2)
          for (let i = 0; i < value.length; i += 2) {
            bytes[i / 2] = parseInt(value.slice(i, i + 2), 16)
          }
          return bytes
        }
        try {
          const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
          const padLength = (4 - (base64.length % 4)) % 4
          const padded = base64 + '='.repeat(padLength)
          const binary = atob(padded)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          return bytes
        } catch {
          return null
        }
      }

      const storedIdBytes = decodeCredentialId(cred.credentialId)
      const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
        if (bytes.buffer instanceof ArrayBuffer) {
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        }
        const copy = new Uint8Array(bytes.byteLength)
        copy.set(bytes)
        return copy.buffer
      }
      const allowCredentials = storedIdBytes
        ? [{ id: toArrayBuffer(storedIdBytes), type: 'public-key' as const }]
        : undefined

      // Perform WebAuthn assertion (verify passkey)
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: 'preferred',
          ...(allowCredentials ? { allowCredentials } : {})
        }
      })

      if (!assertion) {
        alert(t('Passkey verification cancelled'))
        return
      }

      const assertionId = assertion.id as string
      const toHex = (buf: ArrayBuffer) =>
        Array.from(new Uint8Array(buf))
          .map(b => ('0' + b.toString(16)).slice(-2))
          .join('')
      const assertionWithRaw = assertion as PublicKeyCredential
      const assertionRawIdHex = assertionWithRaw?.rawId ? toHex(assertionWithRaw.rawId) : ''
      const stored = cred.credentialId
      const storedLooksHex = /^[0-9a-f]+$/i.test(stored) && stored.length % 2 === 0
      const match = stored === assertionId || (storedLooksHex && stored === assertionRawIdHex)

      if (match) {
        const cfg = new ConfigStore()
        const installId = cfg.getInstallId()
        try {
          await storageManager.initializeEncryptionWithPasskey(installId)
          setPasskeyNotice(null)
          try { (window as any).nativeBridgeAPI?.vaultUnlocked?.() } catch {}
          setMode('vault')
        } catch (e) {
          alert(t('Passkey unlock failed: {{message}}', { message: (e as Error).message }))
        }
      } else {
        alert(t('Passkey does not match. Please use your master password.'))
      }
    } catch (e) {
      const errorMsg = (e as Error).message
      if (errorMsg.includes('cancel') || errorMsg.includes('dismissed')) {
        alert(t('Passkey verification cancelled.'))
      } else {
        alert(t('Passkey verification failed: {{message}}', { message: errorMsg }))
      }
    }
  }

  const generatePassword = () => {
    let charset = ''
    if (options.lowercase) charset += 'abcdefghijklmnopqrstuvwxyz'
    if (options.uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (options.numbers) charset += '0123456789'
    if (options.symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'

    if (charset === '') {
      alert(t('Please select at least one character type'))
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
    const proceed = confirm(t('Clear local data and restart the setup wizard. Continue?'))
    if (!proceed) return
    try {
      const cfg = new ConfigStore()
      ;(window as any).nativeBridgeAPI?.passkeyClearKey?.(cfg.getInstallId())
    } catch {}
    storageManager.resetApp()
    setMasterPassword('')
    setMasterPasswordInput('')
    setShowOnboarding(true)
    setMode('onboarding')
    // Force a clean reload to ensure all state resets consistently on app runtime
    setTimeout(() => {
      window.location.reload()
    }, 50)
  }

  useEffect(() => {
    const handler = () => handleResetApp()
    window.addEventListener('reset-app', handler)
    return () => window.removeEventListener('reset-app', handler)
  }, [handleResetApp])

  // Show onboarding for first-time users
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  if (showOnboarding && mode === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  const showTabs = mode === 'vault' || mode === 'generator' || mode === 'developer'
  const showUpgradeBanner = !isPremium && (mode === 'vault' || mode === 'generator')

  return (
    <div className="app">
      <CustomTitleBar />
      <div className={`container ${mode === 'auth' ? 'container-no-scroll' : 'container-scroll'}`}>
        {mode === 'setup' && (
          <StorageSetup open={true} onClose={() => {}} onConfigured={handleStorageConfigured} />
        )}

        {mode === 'auth' && (
          <div className="auth-screen">
            <div className="auth-logo">
              <img src="icon.png" alt="PassGen Logo" width="80" height="80" />
            </div>
            <h1 className="auth-title">PassGen</h1>
            <p className="auth-subtitle">{hasVault ? t('Enter your master password') : t('Set a new master password')}</p>
            <div className="auth-form">
              <div className="password-input-wrapper">
                <input
                  ref={masterPasswordRef}
                  type={showPassword ? "text" : "password"}
                  value={masterPasswordInput}
                  onChange={(e) => setMasterPasswordInput(e.target.value)}
                  placeholder={hasVault ? t('Master Password (min 8 characters)') : t('Create Master Password (min 8 characters)')}
                  className={`auth-input ${isRTL ? '' : 'ltr-input'}`}
                  onKeyPress={(e) => e.key === 'Enter' && handleMasterPasswordSubmit()}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? t('Hide password') : t('Show password')}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  )}
                </button>
              </div>
              {!hasVault && (
                <input
                  type="text"
                  value={passwordHintInput}
                  onChange={(e) => setPasswordHintInput(e.target.value)}
                  placeholder={t('Password hint (optional)')}
                  className="auth-input hint-input"
                />
              )}
              {passwordHint && hasVault && (
                <p className="password-hint">💡 {t('Hint: {{hint}}', { hint: passwordHint })}</p>
              )}
              <button onClick={handleMasterPasswordSubmit} className="auth-btn">
                {hasVault ? t('Unlock Vault') : t('Set Master Password')}
              </button>
              {localStorage.getItem('passgen-passkey-credential') && (
                <button onClick={handlePasskeyUnlock} className="auth-btn auth-btn-secondary">
                  {t('Unlock with Passkey')}
                </button>
              )}
              {passkeyNotice && <p className="auth-passkey-note">{passkeyNotice}</p>}
              <p className="auth-note">
                {t("Master password unlocks your vault. Don't forget it.")}
              </p>
            </div>
          </div>
        )}

        {showTabs && (
          <>
            <div className="mode-switcher">
              <button
                onClick={() => setMode('vault')}
                className={mode === 'vault' ? 'active' : ''}
              >
                <span className="tab-icon" aria-hidden="true">🗄️</span>
                <span className="tab-label">{t('Vault')}</span>
              </button>
              <button
                onClick={() => setMode('generator')}
                className={mode === 'generator' ? 'active' : ''}
              >
                <span className="tab-icon" aria-hidden="true">🔧</span>
                <span className="tab-label">{t('Generator')}</span>
              </button>
              <button
                onClick={() => setMode('developer')}
                className={mode === 'developer' ? 'active' : ''}
              >
                <span className="tab-icon" aria-hidden="true">🧩</span>
                <span className="tab-label">{t('Developer')}</span>
              </button>
            </div>
            {showUpgradeBanner && (
              <div className="upgrade-inline-banner">
                <span>{t('Free plan: 4 passwords. Upgrade to unlock unlimited entries and sync.')}</span>
                <button className="upgrade-inline-btn" onClick={() => setShowUpgrade(true)}>⭐ {t('Upgrade')}</button>
              </div>
            )}
          </>
        )}

        {mode === 'vault' && (
          <PasswordVault storageManager={storageManager} onGenerateNew={switchToGenerator} />
        )}

        {mode === 'generator' && (
          <>
            <h1>🔐 PassGen</h1>
            <p className="subtitle">{t('Generate Secure Passwords')}</p>

            <div className="password-display">
              <input
                type="text"
                value={password}
                readOnly
                placeholder={t('Click generate to create password')}
                className="password-input ltr-input"
              />
              <button
                onClick={copyToClipboard}
                className="copy-btn"
                disabled={!password}
              >
                {copied ? `✓ ${t('Copied!')}` : `📋 ${t('Copy')}`}
              </button>
            </div>

            <div className="options">
              <div className="option-group">
                <label htmlFor="length">
                  {t('Password Length')}: <strong>{options.length}</strong>
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
                  <span>{t('Uppercase Letters (A-Z)')}</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.lowercase}
                    onChange={(e) => handleOptionChange('lowercase', e.target.checked)}
                  />
                  <span>{t('Lowercase Letters (a-z)')}</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.numbers}
                    onChange={(e) => handleOptionChange('numbers', e.target.checked)}
                  />
                  <span>{t('Numbers (0-9)')}</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.symbols}
                    onChange={(e) => handleOptionChange('symbols', e.target.checked)}
                  />
                  <span>{t('Symbols (!@#$...)')}</span>
                </label>
              </div>
            </div>

            <button onClick={generatePassword} className="generate-btn">
              {t('Generate Password')}
            </button>
          </>
        )}

        {mode === 'developer' && <DeveloperTab />}
      </div>
      <AppFooter />
      <UpgradeModal open={showUpgrade} onClose={()=>setShowUpgrade(false)} />
      <TermsModal open={showTerms} onClose={()=>setShowTerms(false)} />
      <StorageSetup open={showStorageSetup} onClose={()=>setShowStorageSetup(false)} onConfigured={handleStorageConfigured} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}

export default App
