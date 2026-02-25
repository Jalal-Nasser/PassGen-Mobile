import { useEffect, useMemo, useState } from 'react'
import './DeveloperTab.css'
import { useI18n } from '../services/i18n'
import { ConfigStore } from '../services/configStore'
import { applyRemoteLicense, getPlanCapabilities, getPremiumTier } from '../services/license'

export default function DeveloperTab() {
  const { t } = useI18n()
  const store = useMemo(() => new ConfigStore(), [])
  const secretPresets = [
    { id: 'jwt', label: t('JWT / HMAC signing key'), key: 'JWT_SIGNING_KEY' },
    { id: 'api', label: t('API key'), key: 'API_KEY' },
    { id: 'webhook', label: t('Webhook signing secret'), key: 'WEBHOOK_SIGNING_SECRET' },
    { id: 'encryption', label: t('Encryption key'), key: 'ENCRYPTION_KEY' }
  ]
  const [secretPresetId, setSecretPresetId] = useState(() => secretPresets[0]?.id || 'jwt')
  const [secretKeyName, setSecretKeyName] = useState(() => secretPresets[0]?.key || 'JWT_SIGNING_KEY')
  const [secretValues, setSecretValues] = useState<{ base64Url: string; hex: string } | null>(null)
  const [secretProject, setSecretProject] = useState<{ folder: string; hasEnv: boolean; envPath: string } | null>(null)
  const [secretGenerating, setSecretGenerating] = useState(false)
  const [secretInjecting, setSecretInjecting] = useState(false)
  const [secretStatus, setSecretStatus] = useState<string | null>(null)
  const [secretError, setSecretError] = useState<string | null>(null)
  const [planTier, setPlanTier] = useState(getPremiumTier())
  const [dailyCount, setDailyCount] = useState(() => {
    const dateKey = new Date().toISOString().slice(0, 10)
    return store.getDevSecretUsage(dateKey)
  })

  useEffect(() => {
    const preset = secretPresets.find((item) => item.id === secretPresetId)
    if (preset) {
      setSecretKeyName(preset.key)
    }
  }, [secretPresetId])

  useEffect(() => {
    let cancelled = false
    const api = (window as any).nativeBridgeAPI
    const syncLicense = async () => {
      try {
        if (!api?.licenseGetMe) return
        const me = await api.licenseGetMe()
        if (cancelled) return
        applyRemoteLicense(me)
        setPlanTier(getPremiumTier())
      } catch {}
    }
    syncLicense()
    const handler = () => setPlanTier(getPremiumTier())
    window.addEventListener('premium-changed', handler)
    return () => {
      cancelled = true
      window.removeEventListener('premium-changed', handler)
    }
  }, [])

  const handleGenerateSecret = async () => {
    try {
      const dateKey = new Date().toISOString().slice(0, 10)
      const capabilities = getPlanCapabilities(planTier)
      if (capabilities.dailyGenLimit !== null) {
        const current = store.getDevSecretUsage(dateKey)
        if (current >= capabilities.dailyGenLimit) {
          setSecretError(t('Daily limit reached. Upgrade to Pro.'))
          return
        }
      }
      setSecretGenerating(true)
      setSecretError(null)
      setSecretStatus(null)
      const result = await (window as any).nativeBridgeAPI?.devSecretGenerate?.()
      if (!result?.base64Url || !result?.hex) {
        throw new Error('Secret generator unavailable')
      }
      setSecretValues({ base64Url: result.base64Url, hex: result.hex })
      if (capabilities.dailyGenLimit !== null) {
        const next = store.incrementDevSecretUsage(dateKey)
        setDailyCount(next)
      }
      setSecretStatus(t('Secret generated locally.'))
    } catch (error) {
      setSecretError(t('Secret generation failed: {{message}}', { message: (error as Error).message }))
    } finally {
      setSecretGenerating(false)
    }
  }

  const handleCopySecret = async (value: string) => {
    if (!value) return
    setSecretError(null)
    let ok = false
    try {
      ok = await (window as any).nativeBridge?.clipboard?.writeText?.(value)
    } catch {
      ok = false
    }
    if (!ok && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      ok = true
    }
    if (ok) {
      setSecretStatus(t('Copied!'))
    }
  }

  const handleSelectProject = async () => {
    try {
      setSecretError(null)
      setSecretStatus(null)
      const result = await (window as any).nativeBridgeAPI?.devSecretSelectProject?.()
      if (!result?.success || !result.folder) {
        return
      }
      setSecretProject({
        folder: result.folder,
        hasEnv: !!result.hasEnv,
        envPath: result.envPath || ''
      })
    } catch (error) {
      setSecretError(t('Failed to select project folder: {{message}}', { message: (error as Error).message }))
    }
  }

  const handleInjectEnv = async () => {
    try {
      setSecretError(null)
      setSecretStatus(null)
      if (!secretValues) {
        setSecretError(t('Generate a secret first.'))
        return
      }
      if (!secretProject?.folder) {
        setSecretError(t('Select a project folder first.'))
        return
      }
      const keyName = secretKeyName.trim()
      if (!keyName) {
        setSecretError(t('Enter a key name.'))
        return
      }
      setSecretInjecting(true)
      const result = await (window as any).nativeBridgeAPI?.devSecretInjectEnv?.({
        folder: secretProject.folder,
        key: keyName,
        value: secretValues.base64Url
      })
      if (!result?.success) {
        throw new Error('Unable to write .env')
      }
      setSecretStatus(
        result.created
          ? t('Created .env and inserted key.')
          : result.updated
            ? t('Updated key in .env.')
            : t('Added key to .env.')
      )
    } catch (error) {
      setSecretError(t('Failed to write .env: {{message}}', { message: (error as Error).message }))
    } finally {
      setSecretInjecting(false)
    }
  }

  const envKey = secretKeyName.trim()
  const envLine = secretValues && envKey ? `${envKey}=${secretValues.base64Url}` : ''
  const secretBusy = secretGenerating || secretInjecting
  const capabilities = getPlanCapabilities(planTier)
  const dailyLimit = capabilities.dailyGenLimit
  const canGenerate = dailyLimit === null || dailyCount < dailyLimit
  const upgradeRequired = !capabilities.canInjectEnv
  const upgradeTitle = t('Upgrade to Pro to enable .env injection.')

  return (
    <div className="developer-tab">
      <h1>🧩 {t('Developer')}</h1>
      <p className="subtitle">{t('Developer Secret Generator')}</p>
      <div className="developer-card">
        <div className="developer-controls">
          <div className="developer-field">
            <span className="developer-label">{t('Preset')}</span>
            <select value={secretPresetId} onChange={(e) => setSecretPresetId(e.target.value)}>
              {secretPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className="developer-field">
            <span className="developer-label">{t('Env Key')}</span>
            <input
              type="text"
              value={secretKeyName}
              onChange={(e) => setSecretKeyName(e.target.value)}
              placeholder="JWT_SIGNING_KEY"
            />
          </div>
          <div className="developer-actions">
            <button
              className="btn-secondary"
              onClick={handleGenerateSecret}
              disabled={secretBusy || !canGenerate}
              title={!canGenerate ? t('Daily limit reached. Upgrade to Pro.') : undefined}
            >
              {secretGenerating ? t('Generating...') : t('Generate Secret')}
            </button>
          </div>
        </div>
        {dailyLimit !== null && (
          <div className="developer-limit">
            {t('Daily limit: {{count}}/day', { count: dailyLimit })} · {t('Used today: {{count}}', { count: dailyCount })}
          </div>
        )}
        {!canGenerate && (
          <div className="developer-warning">{t('Daily limit reached. Upgrade to Pro.')}</div>
        )}
        <div className="developer-output">
          <div className="developer-output-row">
            <div className="developer-label">{t('Base64URL')}</div>
            <div className="developer-output-line">
              <input readOnly value={secretValues?.base64Url || ''} />
              <button className="btn-secondary" onClick={() => handleCopySecret(secretValues?.base64Url || '')} disabled={!secretValues}>
                {t('Copy secret')}
              </button>
            </div>
          </div>
          {capabilities.canSeeHex && (
            <div className="developer-output-row">
              <div className="developer-label">{t('Hex')}</div>
              <div className="developer-output-line">
                <input readOnly value={secretValues?.hex || ''} />
                <button className="btn-secondary" onClick={() => handleCopySecret(secretValues?.hex || '')} disabled={!secretValues}>
                  {t('Copy secret')}
                </button>
              </div>
            </div>
          )}
          {capabilities.canSeeHex && (
            <div className="developer-output-row">
              <div className="developer-label">{t('.env key pair')}</div>
              <div className="developer-output-line">
                <input readOnly value={envLine} />
                <button className="btn-secondary" onClick={() => handleCopySecret(envLine)} disabled={!envLine}>
                  {t('Copy secret')}
                </button>
              </div>
            </div>
          )}
        </div>
        {upgradeRequired && (
          <div className="developer-upgrade">
            <span>{t('Upgrade to Pro to enable developer tools.')}</span>
            <button className="btn-secondary" onClick={() => window.dispatchEvent(new Event('open-upgrade'))}>
              ⭐ {t('Upgrade')}
            </button>
          </div>
        )}
        <div className="developer-project">
          <button className="btn-secondary" onClick={handleSelectProject} disabled={upgradeRequired} title={upgradeRequired ? upgradeTitle : undefined}>
            {t('Select Project')}
          </button>
          <div className="developer-project-meta">
            {upgradeRequired
              ? t('Upgrade to Pro to enable .env injection.')
              : secretProject
              ? `${secretProject.folder} · ${secretProject.hasEnv ? t('.env detected') : t('No .env found (will be created)')}`
              : t('No project selected')}
          </div>
          <button
            className="btn-secondary"
            onClick={handleInjectEnv}
            disabled={upgradeRequired || !secretValues || !secretProject || !envKey || secretBusy}
            title={upgradeRequired ? upgradeTitle : undefined}
          >
            {secretInjecting ? t('Injecting...') : t('Inject to Project .env')}
          </button>
        </div>
        <div className="developer-note">{t('Secrets are generated locally and never stored in plaintext.')}</div>
        {secretStatus && <div className="developer-status">{secretStatus}</div>}
        {secretError && <div className="developer-error">{secretError}</div>}
      </div>
    </div>
  )
}
