import { useState, useEffect } from 'react'
import type { StorageConfig, ProviderId } from '../services/storageTypes'
import { applyRemoteLicense } from '../services/license'
import { ConfigStore } from '../services/configStore'
import './StorageSetup.css'
import { useI18n } from '../services/i18n'

interface StorageSetupProps {
  open: boolean
  onClose: () => void
  onConfigured: (config: StorageConfig) => void
}

function StorageSetup({ open, onClose, onConfigured }: StorageSetupProps) {
  const [provider, setProvider] = useState<ProviderId>('local')
  const [step, setStep] = useState<'select' | 'config'>('select')
  const [showInfo, setShowInfo] = useState(true)
  const { t } = useI18n()

  const [localFolder, setLocalFolder] = useState('')
  const [localBackupsEnabled, setLocalBackupsEnabled] = useState(true)
  const [localKeepLast, setLocalKeepLast] = useState(10)

  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [licenseError, setLicenseError] = useState<string | null>(null)
  const [cloudEnabled, setCloudEnabled] = useState(false)
  const [licenseStatus, setLicenseStatus] = useState<{ email?: string; plan?: string; isPremium?: boolean } | null>(null)
  const [appAccount, setAppAccount] = useState<{
    email?: string
    userId?: string
    plan?: string
    isPremium?: boolean
    expiresAt?: string | null
  } | null>(null)

  const [s3Config, setS3Config] = useState({
    endpoint: '',
    region: 'us-east-1',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    pathPrefix: ''
  })
  const [s3Testing, setS3Testing] = useState(false)
  const [s3TestResult, setS3TestResult] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const loadStatus = async () => {
      const api = (window as any).electronAPI
      if (!api?.storageProviderStatus) return
      try {
        const status = await api.storageProviderStatus()
        if (status?.activeProviderId) {
          setProvider(status.activeProviderId as ProviderId)
        }
        if (status?.local) {
          setLocalFolder(status.local.vaultFolder || '')
          setLocalBackupsEnabled(status.local.backupsEnabled ?? true)
          setLocalKeepLast(status.local.keepLast ?? 10)
        }
        if (status?.googleDrive) {
          setGoogleConnected(!!status.googleDrive.connected)
          setGoogleEmail(status.googleDrive.email || '')
        }
      } catch (error) {
        console.warn('Failed to load provider status', error)
      }
    }
    loadStatus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const api = (window as any).electronAPI
    if (!api?.licenseGetMe) return

    const refreshLicense = async () => {
      try {
        console.log('[LICENSE DEBUG] calling licenseGetMe()')
        setAuthBusy(true)
        const me = await api.licenseGetMe()
        console.log('[LICENSE DEBUG] result', me)
        setAppAccount((prev: any) => ({ ...(prev || {}), ...me }))
        setLicenseStatus(me)
        syncPremiumFromMe(me)
        setCloudEnabled(!!me?.isPremium)
        setLicenseError(null)
      } catch (error) {
        console.log('[LICENSE DEBUG] error', error)
        const { message, isAuthError } = formatLicenseError(error)
        setLicenseError(message)
        setLicenseStatus(null)
        setCloudEnabled(false)
        if (isAuthError) {
          setAppAccount(null)
        }
      } finally {
        setAuthBusy(false)
      }
    }

    refreshLicense()
  }, [open])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onAuthUpdated) return
    const unsubscribe = api.onAuthUpdated((session: any) => {
      setAppAccount(session)
      setAuthError(null)
      if (!session?.email) {
        syncPremiumFromMe(null)
        setCloudEnabled(false)
        setLicenseStatus(null)
        return
      }
      if (!api?.licenseGetMe) return
      console.log('[LICENSE DEBUG] calling licenseGetMe()')
      api.licenseGetMe()
        .then((me: any) => {
          console.log('[LICENSE DEBUG] result', me)
          setAppAccount((prev: any) => ({ ...(prev || {}), ...me }))
          setLicenseStatus(me)
          syncPremiumFromMe(me)
          setCloudEnabled(!!me?.isPremium)
          setLicenseError(null)
        })
        .catch((error: Error) => {
          console.log('[LICENSE DEBUG] error', error)
          const { message, isAuthError } = formatLicenseError(error)
          setLicenseError(message)
          setLicenseStatus(null)
          setCloudEnabled(false)
          if (isAuthError) {
            setAppAccount(null)
          }
        })
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (open) setStep('select')
  }, [open])

  useEffect(() => {
    if (!open) return
    setGoogleError(null)
    setAuthError(null)
    setLicenseError(null)
  }, [open, provider])

  const formatLicenseError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    const isAuthError = /not authenticated|invalid desktop token|no active app session/i.test(message)
    if (isAuthError) {
      return { message: t('Not signed in'), isAuthError: true }
    }
    return {
      message: t('Connection failed: {{message}}', { message }),
      isAuthError: false
    }
  }

  const syncPremiumFromMe = (me: any) => {
    applyRemoteLicense(me)
  }

  const handleProviderSelect = (next: ProviderId) => {
    if (next === 'dropbox' || next === 'onedrive') return
    if (next === 's3-compatible' && !cloudEnabled) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    setProvider(next)
  }

  const handleContinue = () => {
    if (provider === 's3-compatible' && !cloudEnabled) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (provider === 'dropbox' || provider === 'onedrive') {
      return
    }
    setStep('config')
  }

  const handleSelectFolder = async () => {
    const api = (window as any).electronAPI
    if (!api?.storageSelectVaultFolder) {
      alert(t('Vault backend is not available'))
      return
    }
    const result = await api.storageSelectVaultFolder()
    if (result?.success && result.folder) {
      setLocalFolder(result.folder)
    }
  }

  const handleGoogleConnect = async () => {
    const api = (window as any).electronAPI
    const connect = api?.oauthGoogleDrive || api?.storageGoogleDriveConnect
    if (!connect) {
      setGoogleError(t('Vault backend is not available'))
      return
    }
    if (!api?.licenseGetMe) {
      setLicenseError(t('Vault backend is not available'))
      return
    }
    try {
      const me = await api.licenseGetMe()
      setAppAccount((prev: any) => ({ ...(prev || {}), ...me }))
      setLicenseStatus(me)
      syncPremiumFromMe(me)
      setCloudEnabled(!!me?.isPremium)
      setLicenseError(null)
      if (!me?.email) {
        setGoogleError(t('App account required to continue.'))
        return
      }
      if (!me?.isPremium) {
        window.dispatchEvent(new Event('open-upgrade'))
        return
      }
    } catch (error) {
      const { message, isAuthError } = formatLicenseError(error)
      setLicenseError(message)
      setLicenseStatus(null)
      setCloudEnabled(false)
      if (isAuthError) {
        setAppAccount(null)
      }
      return
    }
    try {
      setGoogleBusy(true)
      setGoogleError(null)
      const result = await connect()
      setGoogleConnected(true)
      setGoogleEmail(result.email || '')
    } catch (error) {
      const message = t('Connection failed: {{message}}', { message: (error as Error).message })
      setGoogleError(message)
    } finally {
      setGoogleBusy(false)
    }
  }

  const handleGoogleDisconnect = async () => {
    const api = (window as any).electronAPI
    if (!api?.storageGoogleDriveDisconnect) {
      setGoogleError(t('Vault backend is not available'))
      return
    }
    try {
      setGoogleBusy(true)
      setGoogleError(null)
      await api.storageGoogleDriveDisconnect()
      setGoogleConnected(false)
      setGoogleEmail('')
    } catch (error) {
      const message = t('Connection failed: {{message}}', { message: (error as Error).message })
      setGoogleError(message)
    } finally {
      setGoogleBusy(false)
    }
  }

  const handleAuthLogin = async () => {
    const api = (window as any).electronAPI
    if (!api?.authLogin) {
      setAuthError(t('Vault backend is not available'))
      return
    }
    try {
      setAuthBusy(true)
      setAuthError(null)
      const store = new ConfigStore()
      const deviceId = store.getInstallId()
      await api.authLogin(deviceId)
    } catch (error) {
      const message = t('Connection failed: {{message}}', { message: (error as Error).message })
      setAuthError(message)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleAuthLogout = async () => {
    const api = (window as any).electronAPI
    if (!api?.authLogout) {
      setAuthError(t('Vault backend is not available'))
      return
    }
    try {
      setAuthBusy(true)
      setAuthError(null)
      await api.authLogout()
      setAppAccount(null)
      syncPremiumFromMe(null)
      setCloudEnabled(false)
      setLicenseError(null)
    } catch (error) {
      const message = t('Connection failed: {{message}}', { message: (error as Error).message })
      setAuthError(message)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleTestS3 = async () => {
    const api = (window as any).electronAPI
    if (!api?.storageTestS3) {
      setS3TestResult(t('Vault backend is not available'))
      return
    }
    if (!s3Config.bucket || !s3Config.accessKeyId || !s3Config.secretAccessKey || !s3Config.region) {
      setS3TestResult(t('Please fill in all required fields first.'))
      return
    }
    try {
      setS3Testing(true)
      const result = await api.storageTestS3(s3Config)
      setS3TestResult(result.ok ? t('Connection successful.') : t('Connection failed: {{message}}', { message: result.error || t('Unknown error') }))
    } catch (error) {
      setS3TestResult(t('Connection failed: {{message}}', { message: (error as Error).message }))
    } finally {
      setS3Testing(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()

    if (provider === 'google-drive' && !googleConnected) {
      alert(t('Connect your Google Drive account to continue.'))
      return
    }
    if (provider === 'google-drive' && !appAccount?.email) {
      alert(t('App account required to continue.'))
      return
    }
    if ((provider === 'google-drive' || provider === 's3-compatible') && !cloudEnabled) {
      alert(t('Upgrade to Premium to enable Google Drive.'))
      return
    }

    if (provider === 's3-compatible') {
      if (!s3Config.bucket || !s3Config.accessKeyId || !s3Config.secretAccessKey || !s3Config.region) {
        alert(t('Please complete all required S3 fields.'))
        return
      }
    }

    const config: StorageConfig = { provider }

    if (provider === 'local') {
      config.local = {
        vaultFolder: localFolder || undefined,
        backupsEnabled: localBackupsEnabled,
        keepLast: localKeepLast
      }
    }

    if (provider === 's3-compatible') {
      config.s3Compatible = {
        endpoint: s3Config.endpoint || undefined,
        region: s3Config.region,
        bucket: s3Config.bucket,
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
        pathPrefix: s3Config.pathPrefix || undefined
      }
    }

    onConfigured(config)
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal clean" onClick={(e) => e.stopPropagation()}>
        <div className="storage-setup">
          <h2>🔒 {t('Configure Storage')}</h2>
          <p className="subtitle">
            {step === 'select' ? t('Choose where to store your encrypted vault') : t('Set up your storage provider')}
          </p>

          {showInfo && step === 'select' && (
            <div className="info-banner">
              <div className="info-content">
                <strong>📌 {t('New to PassGen?')}</strong>
                <p>
                  {t('Start with Local Storage and enable cloud sync later. You can change providers anytime.')}
                </p>
              </div>
              <button onClick={() => setShowInfo(false)} className="close-info">×</button>
            </div>
          )}

          {step === 'select' && (
            <>
              <div className="step-card premium-entry">
                <div className="premium-options">
                  <div className="premium-option">
                    <div className="premium-title">{t('Already Premium?')}</div>
                    <div className="premium-sub">{t('Sign in with Google to unlock cloud storage.')}</div>
                    <div className="premium-action-row">
                      {appAccount?.email ? (
                        <>
                          <span className={`status-pill ${appAccount?.isPremium ? 'premium' : 'free'}`}>
                            {appAccount?.isPremium ? t('Premium active') : t('Free plan')}
                          </span>
                          <button type="button" className="secondary-btn" onClick={handleAuthLogout} disabled={authBusy}>
                            {t('Sign out')}
                          </button>
                        </>
                      ) : (
                        <button type="button" className="secondary-btn premium-google-btn" onClick={handleAuthLogin} disabled={authBusy}>
                          <img src="https://www.gstatic.com/images/branding/product/1x/googlelogo_light_color_92x30dp.png" alt="Google" />
                          {authBusy ? t('Connecting...') : t('Continue with Google')}
                        </button>
                      )}
                    </div>
                    {appAccount?.email && (
                      <div className="status-row">
                        <span className={`status-pill ${appAccount?.isPremium ? 'premium' : 'free'}`}>
                          {appAccount?.isPremium ? t('Premium active') : t('Free plan')}
                        </span>
                        <span className="status-text">
                          {t('Signed in as {{email}}', { email: appAccount.email })}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="premium-option">
                    <div className="premium-title">{t('Become Premium')}</div>
                    <div className="premium-sub">{t('Request activation after payment to unlock Premium.')}</div>
                    <div className="premium-action-row">
                      <button type="button" className="secondary-btn" onClick={() => window.dispatchEvent(new Event('open-upgrade'))}>
                        {t('Request Activation')}
                      </button>
                    </div>
                  </div>
                </div>
                {authError && <p className="help-text error-text">{authError}</p>}
                {licenseError && <p className="help-text error-text">{licenseError}</p>}
              </div>
              {import.meta.env.DEV && (
                <div className="help-text subtle">
                  {`signedIn=${!!appAccount?.email} `}
                  {`meStatus=${licenseStatus ? `${licenseStatus.email || '-'} / ${licenseStatus.plan || '-'} / ${licenseStatus.isPremium ? 'premium' : 'free'}` : 'none'} `}
                  {`lastLicenseError=${licenseError || 'none'} `}
                  {`cloudEnabled=${cloudEnabled}`}
                </div>
              )}
            <div className="provider-selection">
              <label className="provider-option" onClick={() => handleProviderSelect('local')}>
                <input
                  type="radio"
                  name="provider"
                  value="local"
                  checked={provider === 'local'}
                  onChange={() => handleProviderSelect('local')}
                />
                <span className="provider-icon">💾</span>
                <div className="provider-info">
                  <div className="provider-title">
                    <strong>{t('Local Storage')}</strong>
                    <span className="provider-badge default">{t('Default')}</span>
                  </div>
                  <span>{t('Store your encrypted vault on this device')}</span>
                </div>
              </label>

              <label className="provider-option" onClick={() => handleProviderSelect('google-drive')}>
                <input
                  type="radio"
                  name="provider"
                  value="google-drive"
                  checked={provider === 'google-drive'}
                  onChange={() => handleProviderSelect('google-drive')}
                />
                <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" alt="Google Drive" className="provider-icon" />
                <div className="provider-info">
                  <div className="provider-title">
                    <strong>Google Drive</strong>
                    <span className="provider-badge recommended">{t('Recommended')}</span>
                  </div>
                  <span>{t('Encrypted sync/backup with your Google account')}</span>
                </div>
              </label>

              <label className={`provider-option ${!cloudEnabled ? 'disabled' : ''}`} onClick={() => handleProviderSelect('s3-compatible')}>
                <input
                  type="radio"
                  name="provider"
                  value="s3-compatible"
                  checked={provider === 's3-compatible'}
                  onChange={() => handleProviderSelect('s3-compatible')}
                  disabled={!cloudEnabled}
                />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Amazon-S3-Logo.svg/428px-Amazon-S3-Logo.svg.png" alt="S3 Compatible" className="provider-icon" />
                <div className="provider-info">
                  <div className="provider-title">
                    <strong>{t('S3-Compatible Storage')}</strong>
                    <span className="provider-badge advanced">{t('Advanced')}</span>
                  </div>
                  <span>{t('Use AWS, R2, Wasabi, Spaces, MinIO, or custom endpoints')}</span>
                </div>
              </label>

              <label className="provider-option disabled">
                <input type="radio" name="provider" value="dropbox" disabled />
                <span className="provider-icon">📦</span>
                <div className="provider-info">
                  <div className="provider-title">
                    <strong>{t('Dropbox')}</strong>
                    <span className="provider-badge soon">{t('Coming soon')}</span>
                  </div>
                  <span>{t('Encrypted Dropbox backup (Tier B)')}</span>
                </div>
              </label>

              <label className="provider-option disabled">
                <input type="radio" name="provider" value="onedrive" disabled />
                <span className="provider-icon">☁️</span>
                <div className="provider-info">
                  <div className="provider-title">
                    <strong>{t('OneDrive')}</strong>
                    <span className="provider-badge soon">{t('Coming soon')}</span>
                  </div>
                  <span>{t('Encrypted OneDrive backup (Tier B)')}</span>
                </div>
              </label>
            </div>
            </>
          )}

          {step === 'select' && (
            <button type="button" className="submit-btn" onClick={handleContinue}>
              {t('Continue')}
            </button>
          )}

          {step === 'config' && (
            <form onSubmit={handleSaveConfig} className="config-fields">
              {provider === 'local' && (
                <>
                  <h3>{t('Local Storage')}</h3>
                  <div className="form-group">
                    <label>{t('Vault Folder')}</label>
                    <div className="inline-row">
                      <input type="text" value={localFolder} placeholder={t('Choose a folder for your vault')} readOnly className="ltr-input" />
                      <button type="button" className="secondary-btn" onClick={handleSelectFolder}>{t('Browse')}</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={localBackupsEnabled}
                        onChange={(e) => setLocalBackupsEnabled(e.target.checked)}
                      />
                      {t('Enable local version backups')}
                    </label>
                  </div>
                  <div className="form-group">
                    <label>{t('Keep last N versions')}</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={localKeepLast}
                      onChange={(e) => setLocalKeepLast(Number(e.target.value) || 1)}
                      className="ltr-input"
                    />
                  </div>
                </>
              )}

              {provider === 'google-drive' && (
                <>
                  <h3>Google Drive</h3>
                  <div className="step-card">
                    <div className="step-header">
                      <span className="step-pill">{t('Step 1')}</span>
                      <div>
                        <div className="step-title">{t('Continue with Google')}</div>
                        <div className="step-sub">{t('Sign in to verify your plan and unlock cloud storage.')}</div>
                      </div>
                    </div>
                    <div className="inline-row">
                      <input
                        type="text"
                        value={appAccount?.email ? t('Signed in as {{email}}', { email: appAccount.email }) : t('Not signed in')}
                        readOnly
                        aria-readonly="true"
                        className="ltr-input readonly-input"
                      />
                      {appAccount?.email ? (
                        <button type="button" className="secondary-btn" onClick={handleAuthLogout} disabled={authBusy}>
                          {t('Sign out')}
                        </button>
                      ) : (
                        <button type="button" className="secondary-btn" onClick={handleAuthLogin} disabled={authBusy}>
                          {authBusy ? t('Connecting...') : t('Continue with Google')}
                        </button>
                      )}
                    </div>
                    {appAccount?.email && (
                      <div className="status-row">
                        <span className={`status-pill ${appAccount?.isPremium ? 'premium' : 'free'}`}>
                          {appAccount?.isPremium ? t('Premium active') : t('Free plan')}
                        </span>
                        <span className="status-text">
                          {t('Plan: {{plan}}', { plan: appAccount?.plan || 'free' })}
                        </span>
                      </div>
                    )}
                    {authError && <p className="help-text error-text">{authError}</p>}
                    {licenseError && <p className="help-text error-text">{licenseError}</p>}
                  </div>

                  <div className="step-card">
                    <div className="step-header">
                      <span className="step-pill">{t('Step 2')}</span>
                      <div>
                        <div className="step-title">{t('Connect Google Drive')}</div>
                        <div className="step-sub">{t('Link Drive to store encrypted vault snapshots.')}</div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>{t('Account')}</label>
                      <div className="inline-row">
                        <input
                          type="text"
                          value={googleEmail || t('Not connected')}
                          readOnly
                          aria-readonly="true"
                          className={`ltr-input ${googleConnected ? '' : 'readonly-input'}`}
                          title={googleConnected ? googleEmail : t('Click Connect to link your account')}
                        />
                        {googleConnected ? (
                          <button type="button" className="secondary-btn" onClick={handleGoogleDisconnect} disabled={googleBusy}>
                            {t('Disconnect')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={handleGoogleConnect}
                            disabled={googleBusy || !appAccount?.email || !cloudEnabled}
                          >
                            {googleBusy ? t('Connecting...') : t('Connect')}
                          </button>
                        )}
                      </div>
                      <p className="help-text subtle">{t('This field is read-only. Use Connect to link your account.')}</p>
                    </div>
                    {googleConnected ? (
                      <p className="help-text">{t('Drive connected: {{email}}', { email: googleEmail || t('Google Drive') })}</p>
                    ) : (
                      <p className="help-text subtle">{t('Drive not connected')}</p>
                    )}
                    <p className="help-text">{t('Google Drive stores only encrypted vault snapshots. No plaintext ever leaves this device.')}</p>
                    {!appAccount?.email && <p className="help-text">{t('App account required to continue.')}</p>}
                    {appAccount?.email && !cloudEnabled && (
                      <div className="upgrade-inline">
                        <p className="help-text error-text">
                          {t('Upgrade to Premium to enable Google Drive.')}
                        </p>
                        <button type="button" className="link-btn" onClick={() => window.dispatchEvent(new Event('open-upgrade'))}>
                          {t('Upgrade')}
                        </button>
                      </div>
                    )}
                    {licenseError && <p className="help-text error-text">{licenseError}</p>}
                    {googleError && <p className="help-text error-text">{googleError}</p>}
                  </div>
                </>
              )}

              {provider === 's3-compatible' && (
                <>
                  <h3>{t('S3-Compatible Storage')}</h3>
                  <div className="form-group">
                    <label>{t('Endpoint (optional)')}</label>
                    <input
                      type="text"
                      value={s3Config.endpoint}
                      onChange={(e) => setS3Config(prev => ({ ...prev, endpoint: e.target.value }))}
                      placeholder={t('https://s3.amazonaws.com or custom endpoint')}
                      className="ltr-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Region')}</label>
                    <input
                      type="text"
                      value={s3Config.region}
                      onChange={(e) => setS3Config(prev => ({ ...prev, region: e.target.value }))}
                      placeholder="us-east-1"
                      required
                      className="ltr-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Bucket')}</label>
                    <input
                      type="text"
                      value={s3Config.bucket}
                      onChange={(e) => setS3Config(prev => ({ ...prev, bucket: e.target.value }))}
                      placeholder="my-vault-bucket"
                      required
                      className="ltr-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Access Key ID')}</label>
                    <input
                      type="text"
                      value={s3Config.accessKeyId}
                      onChange={(e) => setS3Config(prev => ({ ...prev, accessKeyId: e.target.value }))}
                      placeholder="AKIA..."
                      required
                      className="ltr-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Secret Access Key')}</label>
                    <input
                      type="password"
                      value={s3Config.secretAccessKey}
                      onChange={(e) => setS3Config(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                      placeholder="••••••••"
                      required
                      className="ltr-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Path Prefix (optional)')}</label>
                    <input
                      type="text"
                      value={s3Config.pathPrefix}
                      onChange={(e) => setS3Config(prev => ({ ...prev, pathPrefix: e.target.value }))}
                      placeholder="passgen/"
                      className="ltr-input"
                    />
                  </div>
                  <div className="inline-row">
                    <button type="button" className="secondary-btn" onClick={handleTestS3} disabled={s3Testing}>
                      {s3Testing ? t('Testing...') : t('Test Connection')}
                    </button>
                    {s3TestResult && <span className="test-result">{s3TestResult}</span>}
                  </div>
                </>
              )}

              <div className="config-actions">
                <button type="button" className="secondary-btn" onClick={() => setStep('select')}>{t('Back')}</button>
                <button type="submit" className="submit-btn">{t('Save')}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default StorageSetup
