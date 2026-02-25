import { useState, useEffect } from 'react'
import type { StorageConfig, ProviderId } from '../services/storageTypes'
import { applyRemoteLicense, type PremiumTier } from '../services/license'
import { ConfigStore } from '../services/configStore'
import './StorageSetup.css'
import { useI18n } from '../services/i18n'
import googleIconSvg from '../assets/google-g.svg?raw'
import supabaseIconSvg from '../assets/supabase.svg?raw'
import oneDriveIconSvg from '../assets/onedrive.svg?raw'

const googleIconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(googleIconSvg)}`
const supabaseIconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(supabaseIconSvg)}`
const oneDriveIconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(oneDriveIconSvg)}`

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
  const [oneDriveConnected, setOneDriveConnected] = useState(false)
  const [oneDriveEmail, setOneDriveEmail] = useState('')
  const [oneDriveBusy, setOneDriveBusy] = useState(false)
  const [oneDriveError, setOneDriveError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [licenseError, setLicenseError] = useState<string | null>(null)
  const [planTier, setPlanTier] = useState<PremiumTier>('free')
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
  const allowGoogle = planTier === 'cloud' || planTier === 'byos'
  const allowOneDrive = planTier === 'cloud' || planTier === 'byos'
  const allowS3 = planTier === 'byos'
  const [supabaseConfig, setSupabaseConfig] = useState(() => {
    const store = new ConfigStore()
    return {
      projectUrl: '',
      bucket: 'passgen-vault',
      pathPrefix: `vaults/${store.getInstallId()}`,
      anonKey: '',
      authMode: 'anon' as 'anon' | 'oauth'
    }
  })
  const [supabaseTesting, setSupabaseTesting] = useState(false)
  const [supabaseTestResult, setSupabaseTestResult] = useState<string | null>(null)
  const allowSupabase = planTier === 'byos'

  useEffect(() => {
    if (!open) return
    const loadStatus = async () => {
      const api = (window as any).nativeBridgeAPI
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
        if (status?.oneDrive) {
          setOneDriveConnected(!!status.oneDrive.connected)
          setOneDriveEmail(status.oneDrive.email || '')
        }
      } catch (error) {
        console.warn('Failed to load provider status', error)
      }
    }
    loadStatus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const api = (window as any).nativeBridgeAPI
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
        setPlanTier(normalizePlan(me?.plan, me?.isPremium))
        setLicenseError(null)
      } catch (error) {
        console.log('[LICENSE DEBUG] error', error)
        const { message, isAuthError } = formatLicenseError(error)
        setLicenseError(message)
        setLicenseStatus(null)
        setPlanTier('free')
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
    const api = (window as any).nativeBridgeAPI
    if (!api?.onAuthUpdated) return
    const unsubscribe = api.onAuthUpdated((session: any) => {
      setAppAccount(session)
      setAuthError(null)
      if (!session?.email) {
        syncPremiumFromMe(null)
        setPlanTier('free')
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
          setPlanTier(normalizePlan(me?.plan, me?.isPremium))
          setLicenseError(null)
        })
        .catch((error: Error) => {
          console.log('[LICENSE DEBUG] error', error)
          const { message, isAuthError } = formatLicenseError(error)
          setLicenseError(message)
          setLicenseStatus(null)
          setPlanTier('free')
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
    setOneDriveError(null)
    setAuthError(null)
    setLicenseError(null)
    setS3TestResult(null)
    setSupabaseTestResult(null)
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

  const formatOneDriveError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (/onedrive oauth credentials are not configured/i.test(message)) {
      return t('OneDrive requires your own Azure App registration (Client ID).')
    }
    return t('Connection failed: {{message}}', { message })
  }

  const syncPremiumFromMe = (me: any) => {
    applyRemoteLicense(me)
  }

  const normalizePlan = (plan?: string, isPremium?: boolean): PremiumTier => {
    const raw = String(plan || '').toLowerCase()
    if (raw === 'pro' || raw === 'cloud' || raw === 'byos') return raw
    if (raw === 'power') return 'byos'
    return isPremium ? 'cloud' : 'free'
  }

  const handleProviderSelect = (next: ProviderId) => {
    if (next === 'dropbox') return
    if (next === 'google-drive' && !allowGoogle) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (next === 'onedrive' && !allowOneDrive) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (next === 's3-compatible' && !allowS3) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (next === 'supabase' && !allowSupabase) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    setProvider(next)
  }

  const handleContinue = () => {
    if (provider === 'google-drive' && !allowGoogle) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (provider === 'onedrive' && !allowOneDrive) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (provider === 's3-compatible' && !allowS3) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (provider === 'supabase' && !allowSupabase) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (provider === 'dropbox') {
      return
    }
    setStep('config')
  }

  const handleSelectFolder = async () => {
    const api = (window as any).nativeBridgeAPI
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
    const api = (window as any).nativeBridgeAPI
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
      const nextTier = normalizePlan(me?.plan, me?.isPremium)
      setPlanTier(nextTier)
      setLicenseError(null)
      if (!me?.email) {
        setGoogleError(t('App account required to continue.'))
        return
      }
      const canUseGoogle = nextTier === 'cloud' || nextTier === 'byos'
      if (!canUseGoogle) {
        setGoogleError(t('Upgrade to Cloud or BYOS to enable Google Drive.'))
        window.dispatchEvent(new Event('open-upgrade'))
        return
      }
    } catch (error) {
      const { message, isAuthError } = formatLicenseError(error)
      setLicenseError(message)
      setLicenseStatus(null)
      setPlanTier('free')
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
    const api = (window as any).nativeBridgeAPI
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

  const handleOneDriveConnect = async () => {
    const api = (window as any).nativeBridgeAPI
    const connect = api?.storageOneDriveConnect
    if (!connect) {
      setOneDriveError(t('Vault backend is not available'))
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
      const nextTier = normalizePlan(me?.plan, me?.isPremium)
      setPlanTier(nextTier)
      setLicenseError(null)
      if (!me?.email) {
        setOneDriveError(t('App account required to continue.'))
        return
      }
      const canUseOneDrive = nextTier === 'cloud' || nextTier === 'byos'
      if (!canUseOneDrive) {
        setOneDriveError(t('Upgrade to Cloud or BYOS to enable OneDrive.'))
        window.dispatchEvent(new Event('open-upgrade'))
        return
      }
    } catch (error) {
      const { message, isAuthError } = formatLicenseError(error)
      setLicenseError(message)
      setLicenseStatus(null)
      setPlanTier('free')
      if (isAuthError) {
        setAppAccount(null)
      }
      return
    }

    try {
      setOneDriveBusy(true)
      setOneDriveError(null)
      const result = await connect()
      setOneDriveConnected(true)
      setOneDriveEmail(result.email || '')
    } catch (error) {
      setOneDriveError(formatOneDriveError(error))
    } finally {
      setOneDriveBusy(false)
    }
  }

  const handleOneDriveDisconnect = async () => {
    const api = (window as any).nativeBridgeAPI
    if (!api?.storageOneDriveDisconnect) {
      setOneDriveError(t('Vault backend is not available'))
      return
    }
    try {
      setOneDriveBusy(true)
      setOneDriveError(null)
      await api.storageOneDriveDisconnect()
      setOneDriveConnected(false)
      setOneDriveEmail('')
    } catch (error) {
      const message = t('Connection failed: {{message}}', { message: (error as Error).message })
      setOneDriveError(message)
    } finally {
      setOneDriveBusy(false)
    }
  }

  const handleAuthLogin = async () => {
    const api = (window as any).nativeBridgeAPI
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
    const api = (window as any).nativeBridgeAPI
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
      setPlanTier('free')
      setLicenseError(null)
    } catch (error) {
      const message = t('Connection failed: {{message}}', { message: (error as Error).message })
      setAuthError(message)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleTestS3 = async () => {
    const api = (window as any).nativeBridgeAPI
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

  const handleTestSupabase = async () => {
    const api = (window as any).nativeBridgeAPI
    if (!api?.storageSupabaseTest) {
      setSupabaseTestResult(t('Vault backend is not available'))
      return
    }
    if (!supabaseConfig.projectUrl || !supabaseConfig.bucket || (supabaseConfig.authMode === 'anon' && !supabaseConfig.anonKey)) {
      setSupabaseTestResult(t('Please fill in all required fields first.'))
      return
    }
    try {
      setSupabaseTesting(true)
      const result = await api.storageSupabaseTest(supabaseConfig)
      setSupabaseTestResult(result.ok ? t('Connection successful.') : t('Connection failed: {{message}}', { message: result.error || t('Unknown error') }))
    } catch (error) {
      setSupabaseTestResult(t('Connection failed: {{message}}', { message: (error as Error).message }))
    } finally {
      setSupabaseTesting(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()

    if (provider === 'google-drive' && !googleConnected) {
      alert(t('Connect your Google Drive account to continue.'))
      return
    }
    if (provider === 'onedrive' && !oneDriveConnected) {
      alert(t('Connect your OneDrive account to continue.'))
      return
    }
    if (provider === 'google-drive' && !appAccount?.email) {
      alert(t('App account required to continue.'))
      return
    }
    if (provider === 'onedrive' && !appAccount?.email) {
      alert(t('App account required to continue.'))
      return
    }
    if (provider === 'google-drive' && !allowGoogle) {
      alert(t('Upgrade to Cloud or BYOS to enable Google Drive.'))
      return
    }
    if (provider === 'onedrive' && !allowOneDrive) {
      alert(t('Upgrade to Cloud or BYOS to enable OneDrive.'))
      return
    }
    if (provider === 's3-compatible' && !allowS3) {
      alert(t('Upgrade to BYOS to enable S3-compatible storage.'))
      return
    }
    if (provider === 'supabase' && !allowSupabase) {
      alert(t('Upgrade to BYOS to enable Supabase Storage.'))
      return
    }

    if (provider === 's3-compatible') {
      if (!s3Config.bucket || !s3Config.accessKeyId || !s3Config.secretAccessKey || !s3Config.region) {
        alert(t('Please complete all required S3 fields.'))
        return
      }
    }

    if (provider === 'supabase') {
      if (!supabaseConfig.projectUrl || !supabaseConfig.bucket || (supabaseConfig.authMode === 'anon' && !supabaseConfig.anonKey)) {
        alert(t('Please complete all required Supabase fields.'))
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

    if (provider === 'supabase') {
      config.supabase = {
        projectUrl: supabaseConfig.projectUrl,
        bucket: supabaseConfig.bucket,
        anonKey: supabaseConfig.anonKey,
        pathPrefix: supabaseConfig.pathPrefix || undefined,
        authMode: supabaseConfig.authMode
      }
    }

    onConfigured(config)
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal clean modal-scroll" onClick={(e) => e.stopPropagation()}>
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
                          <button type="button" className="secondary-btn" onClick={handleAuthLogout} disabled={authBusy}>
                            {t('Sign out')}
                          </button>
                        </>
                      ) : (
                        <button type="button" className="secondary-btn premium-google-btn" onClick={handleAuthLogin} disabled={authBusy}>
                          <img
                            src={googleIconUrl}
                            alt="Google"
                          />
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
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          onClose()
                          window.dispatchEvent(new Event('open-upgrade'))
                        }}
                      >
                        {t('Become Premium')}
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
                  {`planTier=${planTier} allowGoogle=${allowGoogle} allowOneDrive=${allowOneDrive} allowS3=${allowS3} allowSupabase=${allowSupabase}`}
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

              <label className={`provider-option ${!allowGoogle ? 'disabled' : ''}`} onClick={() => handleProviderSelect('google-drive')}>
                <input
                  type="radio"
                  name="provider"
                  value="google-drive"
                  checked={provider === 'google-drive'}
                  onChange={() => handleProviderSelect('google-drive')}
                  disabled={!allowGoogle}
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

              <label className={`provider-option ${!allowS3 ? 'disabled' : ''}`} onClick={() => handleProviderSelect('s3-compatible')}>
                <input
                  type="radio"
                  name="provider"
                  value="s3-compatible"
                  checked={provider === 's3-compatible'}
                  onChange={() => handleProviderSelect('s3-compatible')}
                  disabled={!allowS3}
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

              <label className={`provider-option ${!allowSupabase ? 'disabled' : ''}`} onClick={() => handleProviderSelect('supabase')}>
                <input
                  type="radio"
                  name="provider"
                  value="supabase"
                  checked={provider === 'supabase'}
                  onChange={() => handleProviderSelect('supabase')}
                  disabled={!allowSupabase}
                />
                <img src={supabaseIconUrl} alt="Supabase" className="provider-icon" />
                <div className="provider-info">
                  <div className="provider-title">
                    <strong>{t('Supabase Storage')}</strong>
                    <span className="provider-badge advanced">{t('Advanced')}</span>
                  </div>
                  <span>{t('Use your Supabase Storage for encrypted snapshots')}</span>
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

              <label className={`provider-option ${!allowOneDrive ? 'disabled' : ''}`} onClick={() => handleProviderSelect('onedrive')}>
                <input
                  type="radio"
                  name="provider"
                  value="onedrive"
                  checked={provider === 'onedrive'}
                  onChange={() => handleProviderSelect('onedrive')}
                  disabled={!allowOneDrive}
                />
                <img src={oneDriveIconUrl} alt="OneDrive" className="provider-icon" />
                <div className="provider-info">
                  <div className="provider-title">
                    <strong>{t('OneDrive (BYO Azure)')}</strong>
                    <span className="provider-badge recommended">{t('Recommended')}</span>
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
                            disabled={googleBusy || !appAccount?.email || !allowGoogle}
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
                    {appAccount?.email && !allowGoogle && (
                      <div className="upgrade-inline">
                        <p className="help-text error-text">
                          {t('Upgrade to Cloud or BYOS to enable Google Drive.')}
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

              {provider === 'onedrive' && (
                <>
                  <h3>OneDrive</h3>
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
                        <div className="step-title">{t('Connect OneDrive')}</div>
                        <div className="step-sub">{t('Link OneDrive to store encrypted vault snapshots.')}</div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>{t('Account')}</label>
                      <div className="inline-row">
                        <input
                          type="text"
                          value={oneDriveEmail || t('Not connected')}
                          readOnly
                          aria-readonly="true"
                          className={`ltr-input ${oneDriveConnected ? '' : 'readonly-input'}`}
                          title={oneDriveConnected ? oneDriveEmail : t('Click Connect to link your account')}
                        />
                        {oneDriveConnected ? (
                          <button type="button" className="secondary-btn" onClick={handleOneDriveDisconnect} disabled={oneDriveBusy}>
                            {t('Disconnect')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={handleOneDriveConnect}
                            disabled={oneDriveBusy || !appAccount?.email || !allowOneDrive}
                          >
                            {oneDriveBusy ? t('Connecting...') : t('Connect')}
                          </button>
                        )}
                      </div>
                      <p className="help-text subtle">{t('This field is read-only. Use Connect to link your account.')}</p>
                    </div>
                    {oneDriveConnected ? (
                      <p className="help-text">{t('Drive connected: {{email}}', { email: oneDriveEmail || t('OneDrive') })}</p>
                    ) : (
                      <p className="help-text subtle">{t('Drive not connected')}</p>
                    )}
                    <p className="help-text subtle">{t('OneDrive requires your own Azure App registration (Client ID).')}</p>
                    <p className="help-text">{t('OneDrive stores only encrypted vault snapshots. No plaintext ever leaves this device.')}</p>
                    {!appAccount?.email && <p className="help-text">{t('App account required to continue.')}</p>}
                    {appAccount?.email && !allowOneDrive && (
                      <div className="upgrade-inline">
                        <p className="help-text error-text">
                          {t('Upgrade to Cloud or BYOS to enable OneDrive.')}
                        </p>
                        <button type="button" className="link-btn" onClick={() => window.dispatchEvent(new Event('open-upgrade'))}>
                          {t('Upgrade')}
                        </button>
                      </div>
                    )}
                    {licenseError && <p className="help-text error-text">{licenseError}</p>}
                    {oneDriveError && <p className="help-text error-text">{oneDriveError}</p>}
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

              {provider === 'supabase' && (
                <>
                  <h3>{t('Supabase Storage')}</h3>
                  <div className="form-group">
                    <label>{t('Project URL')}</label>
                    <input
                      type="text"
                      value={supabaseConfig.projectUrl}
                      onChange={(e) => setSupabaseConfig(prev => ({ ...prev, projectUrl: e.target.value.trim() }))}
                      placeholder="https://your-project.supabase.co"
                      required
                      className="ltr-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Bucket')}</label>
                    <input
                      type="text"
                      value={supabaseConfig.bucket}
                      onChange={(e) => setSupabaseConfig(prev => ({ ...prev, bucket: e.target.value }))}
                      placeholder="passgen-vault"
                      required
                      className="ltr-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Path Prefix (optional)')}</label>
                    <input
                      type="text"
                      value={supabaseConfig.pathPrefix}
                      onChange={(e) => setSupabaseConfig(prev => ({ ...prev, pathPrefix: e.target.value }))}
                      placeholder={supabaseConfig.pathPrefix}
                      className="ltr-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Auth Mode')}</label>
                    <div className="auth-toggle">
                      <label className="auth-toggle-option disabled">
                        <input type="radio" name="supabase-auth" checked={supabaseConfig.authMode === 'oauth'} readOnly disabled />
                        <span>{t('Sign in with Supabase (recommended)')}</span>
                        <span className="toggle-pill">{t('Coming soon')}</span>
                      </label>
                      <label className="auth-toggle-option">
                        <input
                          type="radio"
                          name="supabase-auth"
                          checked={supabaseConfig.authMode === 'anon'}
                          onChange={() => setSupabaseConfig(prev => ({ ...prev, authMode: 'anon' }))}
                        />
                        <span>{t('Paste anon key (advanced)')}</span>
                      </label>
                    </div>
                  </div>
                  {supabaseConfig.authMode === 'anon' && (
                    <div className="form-group">
                      <label>{t('Anon key')}</label>
                      <input
                        type="password"
                        value={supabaseConfig.anonKey}
                        onChange={(e) => setSupabaseConfig(prev => ({ ...prev, anonKey: e.target.value }))}
                        placeholder="eyJhbGciOi..."
                        required
                        className="ltr-input"
                      />
                    </div>
                  )}
                  <div className="inline-row">
                    <button type="button" className="secondary-btn" onClick={handleTestSupabase} disabled={supabaseTesting || !allowSupabase}>
                      {supabaseTesting ? t('Testing...') : t('Test Connection')}
                    </button>
                    {supabaseTestResult && <span className="test-result">{supabaseTestResult}</span>}
                  </div>
                  {!allowSupabase && (
                    <div className="upgrade-inline">
                      <p className="help-text error-text">{t('Upgrade to BYOS to enable Supabase Storage.')}</p>
                      <button type="button" className="link-btn" onClick={() => window.dispatchEvent(new Event('open-upgrade'))}>
                        {t('Upgrade')}
                      </button>
                    </div>
                  )}
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
