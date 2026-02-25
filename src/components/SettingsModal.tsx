import { useEffect, useState } from 'react'
import './UpgradeModal.css'
import './SettingsModal.css'
import { useI18n } from '../services/i18n'
import { ConfigStore } from '../services/configStore'
import type { ProviderId } from '../services/storageTypes'
import googleIconSvg from '../assets/google-g.svg?raw'

const googleIconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(googleIconSvg)}`

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t, language, setLanguage } = useI18n()
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null)
  const [hasPasskey, setHasPasskey] = useState(() => {
    const store = new ConfigStore()
    return !!store.getPasskeyCredential()?.credentialId
  })
  const [minimizeToTray, setMinimizeToTray] = useState(true)
  const [vaultPath, setVaultPath] = useState('')
  const [vaultLocationError, setVaultLocationError] = useState<string | null>(null)
  const [vaultLocationBusy, setVaultLocationBusy] = useState(false)
  const [localBackupsEnabled, setLocalBackupsEnabled] = useState(true)
  const [localKeepLast, setLocalKeepLast] = useState(10)
  const [activeProviderId, setActiveProviderId] = useState<ProviderId>('local')

  useEffect(() => {
    if (!open) return
    const api = (window as any).nativeBridgeAPI
    if (!api?.settingsGet) return
    api.settingsGet()
      .then((result: any) => {
        if (typeof result?.minimizeToTray === 'boolean') {
          setMinimizeToTray(result.minimizeToTray)
        }
      })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    const api = (window as any).nativeBridgeAPI
    if (!api?.storageProviderStatus && !api?.vaultStatus) return

    const loadLocation = async () => {
      try {
        const status = await api.storageProviderStatus?.()
        if (status?.activeProviderId) {
          setActiveProviderId(status.activeProviderId as ProviderId)
        }
        if (status?.local) {
          setLocalBackupsEnabled(status.local.backupsEnabled ?? true)
          setLocalKeepLast(status.local.keepLast ?? 10)
        }
      } catch {
        // Ignore provider status fetch errors here
      }

      try {
        const vaultStatus = await api.vaultStatus?.()
        if (vaultStatus?.vaultPath) {
          setVaultPath(vaultStatus.vaultPath)
        }
      } catch {
        // Ignore vault status fetch errors here
      }
    }

    loadLocation()
  }, [open])
  const openPremiumSignIn = () => {
    onClose()
    window.dispatchEvent(new Event('open-storage-setup'))
  }
  const openPremiumUpgrade = () => {
    onClose()
    window.dispatchEvent(new Event('open-upgrade'))
  }
  const handleResetApp = () => {
    onClose()
    window.dispatchEvent(new Event('reset-app'))
  }

  const handleChangeVaultFolder = async () => {
    const api = (window as any).nativeBridgeAPI
    if (!api?.storageSelectVaultFolder || !api?.storageConfigure) {
      setVaultLocationError(t('Vault backend is not available'))
      return
    }
    try {
      setVaultLocationBusy(true)
      setVaultLocationError(null)
      const result = await api.storageSelectVaultFolder()
      if (!result?.success || !result.folder) return

      const config = {
        provider: activeProviderId,
        local: {
          vaultFolder: result.folder,
          backupsEnabled: localBackupsEnabled,
          keepLast: localKeepLast
        }
      }
      await api.storageConfigure(config)
      try {
        const store = new ConfigStore()
        const existing = store.getStorageConfig() || { provider: activeProviderId }
        store.setStorageConfig({
          ...existing,
          provider: activeProviderId,
          local: {
            ...existing.local,
            vaultFolder: result.folder,
            backupsEnabled: localBackupsEnabled,
            keepLast: localKeepLast
          }
        })
      } catch (error) {
        console.warn('Failed to cache storage config locally:', error)
      }

      const vaultStatus = await api.vaultStatus?.()
      if (vaultStatus?.vaultPath) {
        setVaultPath(vaultStatus.vaultPath)
      }
    } catch (error) {
      setVaultLocationError(t('Failed to update vault location: {{message}}', { message: (error as Error).message }))
    } finally {
      setVaultLocationBusy(false)
    }
  }
  const handleSetupPasskey = async () => {
    try {
      setPasskeyBusy(true)
      setPasskeyMessage(null)
      if (!navigator.credentials || !navigator.credentials.create) {
        alert(t('Passkey is not supported on this device or browser'))
        return
      }
      const protocol = window.location.protocol
      const host = window.location.hostname
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
      const isAllowedOrigin = protocol === 'https:' || (protocol === 'http:' && isLocalhost)
      if (!window.isSecureContext || !isAllowedOrigin) {
        alert(t('Passkey requires a secure context. This feature is not available in this mode.'))
        return
      }

      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PassGen' },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'passgen-user',
            displayName: 'PassGen User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          timeout: 60000,
          attestation: 'none'
        }
      })

      if (!credential) {
        alert(t('Passkey registration cancelled'))
        return
      }
      if (credential.type !== 'public-key') {
        alert(t('Invalid credential type received'))
        return
      }

      const store = new ConfigStore()
      store.setPasskeyCredential(credential.id, 'passkey-registered')
      setHasPasskey(true)
      try {
        await (window as any).nativeBridgeAPI?.passkeyStoreKey?.(store.getInstallId())
        setPasskeyMessage(t('Passkey setup successful! You can now unlock with your biometric.'))
      } catch (error) {
        setPasskeyMessage(t('Passkey created, but unlock is not enabled on this device. {{message}}', {
          message: (error as Error).message || ''
        }))
      }
    } catch (e) {
      const errorMsg = (e as Error).message
      if (errorMsg.includes('cancel') || errorMsg.includes('dismissed')) {
        alert(t('Passkey setup cancelled'))
      } else {
        alert(t('Passkey setup failed: {{message}}', { message: errorMsg }))
      }
    } finally {
      setPasskeyBusy(false)
    }
  }
  const handleMinimizeToTrayChange = async (value: boolean) => {
    setMinimizeToTray(value)
    const api = (window as any).nativeBridgeAPI
    if (!api?.settingsSet) return
    try {
      const result = await api.settingsSet({ minimizeToTray: value })
      if (typeof result?.minimizeToTray === 'boolean') {
        setMinimizeToTray(result.minimizeToTray)
      }
    } catch {
      setMinimizeToTray(!value)
    }
  }
  if (!open) return null
  const passkeyStatus = passkeyMessage || (hasPasskey ? t('Passkey setup successful! You can now unlock with your biometric.') : null)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('Settings')}</h2>
        <div className="settings-grid">
          <div className="settings-section settings-section--full">
            <label htmlFor="app-language">{t('Language')}</label>
            <select
              id="app-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'ar')}
            >
              <option value="en">{t('English')}</option>
              <option value="ar">{t('Arabic')}</option>
            </select>
          </div>
          <div className="settings-section settings-section--full">
            <label>{t('Minimize to tray')}</label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={minimizeToTray}
                onChange={(e) => handleMinimizeToTrayChange(e.target.checked)}
              />
              <span>{t('Keep PassGen running in the tray when you close the window.')}</span>
            </label>
          </div>
          <div className="settings-section settings-section--full">
            <label>{t('Premium Access')}</label>
            <div className="settings-premium-card">
              <div className="settings-premium-option">
                <div className="settings-premium-title">{t('Already Premium?')}</div>
                <div className="settings-premium-sub">{t('Sign in with Google to connect cloud storage.')}</div>
                <button className="btn-secondary settings-google-btn" onClick={openPremiumSignIn}>
                  <img
                    src={googleIconUrl}
                    alt="Google"
                  />
                  {t('Continue with Google')}
                </button>
              </div>
              <div className="settings-premium-option">
                <div className="settings-premium-title">{t('Become Premium')}</div>
                <div className="settings-premium-sub">{t('Pick a plan on the payment page, then enter your license key.')}</div>
                <button className="btn-secondary" onClick={openPremiumUpgrade}>
                  {t('Pick a Plan')}
                </button>
              </div>
            </div>
          </div>
          <div className="settings-section settings-section--full">
            <label>{t('Local Vault Location')}</label>
            <div className="settings-location-card">
              <input
                type="text"
                value={vaultPath || t('Not available')}
                readOnly
                className="settings-path-input ltr-input"
              />
              <button
                className="btn-secondary"
                onClick={handleChangeVaultFolder}
                disabled={vaultLocationBusy}
              >
                {vaultLocationBusy ? t('Updating...') : t('Change Folder')}
              </button>
            </div>
            <div className="settings-location-sub">
              {t('Your encrypted vault file is stored locally. Changing the folder will move it if found.')}
            </div>
            {vaultLocationError && <div className="settings-location-error">{vaultLocationError}</div>}
          </div>
          <div className="settings-section">
            <label>{t('Setup Passkey')}</label>
            <div className="settings-passkey-card">
              <div className="settings-premium-sub">{t('Unlock with Passkey')}</div>
              <button className="btn-secondary" onClick={handleSetupPasskey} disabled={passkeyBusy}>
                {passkeyBusy ? t('Connecting...') : t('Setup Passkey')}
              </button>
              {passkeyStatus && <div className="settings-passkey-status">{passkeyStatus}</div>}
            </div>
          </div>
          <div className="settings-section">
            <label>{t('Reset App')}</label>
            <div className="settings-reset-card">
              <div className="settings-premium-sub">{t('Clear local data and restart wizard')}</div>
              <button className="settings-danger-btn" onClick={handleResetApp}>
                {t('Reset App')}
              </button>
            </div>
          </div>
        </div>
        <div className="actions">
          <button className="btn-secondary" onClick={onClose}>{t('Close')}</button>
        </div>
      </div>
    </div>
  )
}
