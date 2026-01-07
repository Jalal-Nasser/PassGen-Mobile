import { useEffect, useState } from 'react'
import { ConfigStore } from '../services/configStore'
import { applyRemoteLicense } from '../services/license'
import { copyText } from '../services/clipboard'
import './UpgradeModal.css'
import { useI18n } from '../services/i18n'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
}

const PREMIUM_PRICE = '$15 / 6 months'
const CRYPTO_ADDRESS_USDT_BSC = '0x39A31EaE0026D10D801859aF75691119d2cD367C'
const CRYPTO_QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=340x340&data=${encodeURIComponent(CRYPTO_ADDRESS_USDT_BSC)}`
const PAYPAL_QR_PATH = 'qr.png' // Provided PayPal QR code asset (relative for packaged apps)

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const store = new ConfigStore()
  const { t } = useI18n()
  const [installId, setInstallId] = useState<string>('')
  const [appAccount, setAppAccount] = useState<{ email?: string } | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setInstallId(store.getInstallId())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const api = (window as any).electronAPI
    if (!api?.authGetSession) return
    api.authGetSession()
      .then((session: any) => {
        setAppAccount(session)
        setAuthError(null)
      })
      .catch((error: Error) => {
        setAuthError(t('Connection failed: {{message}}', { message: error.message }))
      })
  }, [open, t])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onAuthUpdated) return
    const unsubscribe = api.onAuthUpdated((session: any) => {
      setAppAccount(session)
      setAuthError(null)
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const [userEmail, setUserEmail] = useState(store.getUserEmail())
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'crypto'>('paypal')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const requestActivation = async () => {
    if (sending) return
    setSending(true)
    const requestId = store.getInstallId()
    if (userEmail) {
      store.setUserEmail(userEmail)
    }
    try {
      const res = await window.electron.payment.requestActivation({ email: userEmail, requestId, paymentMethod })
      if (res.success) {
        setSent(true)
        alert(t('Activation request sent. You will be activated after verification.'))
      } else {
        alert(res.error || t('Failed to send activation request.'))
      }
    } catch (e:any) {
      alert(t('Failed to send activation request: {{message}}', { message: e.message }))
    } finally {
      setSending(false)
    }
  }

  const [licenseKey, setLicenseKey] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const ensureAppAccount = async (): Promise<boolean> => {
    const api = (window as any).electronAPI
    if (!api?.authGetSession) {
      alert(t('App account required to continue.'))
      return false
    }
    const session = await api.authGetSession()
    if (session?.email) return true
    if (api?.authLogin) {
      await api.authLogin(store.getInstallId())
    }
    alert(t('App account required to continue.'))
    return false
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
      await api.authLogin(store.getInstallId())
    } catch (error: any) {
      setAuthError(t('Connection failed: {{message}}', { message: error.message }))
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
    } catch (error: any) {
      setAuthError(t('Connection failed: {{message}}', { message: error.message }))
    } finally {
      setAuthBusy(false)
    }
  }

  const redeemLicenseKey = async () => {
    if (!licenseKey) { alert(t('Enter license key')); return }
    const hasAccount = await ensureAppAccount()
    if (!hasAccount) {
      return
    }
    try {
      setRedeeming(true)
      const api = (window as any).electronAPI
      if (!api?.licenseRedeem) {
        throw new Error('License backend is not available')
      }
      const result = await api.licenseRedeem({ licenseKey, deviceId: installId })
      applyRemoteLicense(result)
      if (result?.isPremium) {
        onClose()
        alert(t('Premium activated. Enjoy!'))
      } else {
        alert(t('Activation pending. Please contact support if it does not update soon.'))
      }
    } catch (e:any) {
      alert(t('License redeem failed: {{message}}', { message: e.message }))
    } finally {
      setRedeeming(false)
    }
  }

  const copyInstallId = async () => {
    try {
      const ok = await copyText(installId)
      if (!ok) alert(t('Failed to copy Install ID'))
    } catch {
      alert(t('Failed to copy Install ID'))
    }
  }

  const copyCryptoAddress = async () => {
    try {
      const ok = await copyText(CRYPTO_ADDRESS_USDT_BSC)
      if (!ok) alert(t('Failed to copy address'))
    } catch {
      alert(t('Failed to copy address'))
    }
  }

  if (!open) return null

  if (store.isPremium()) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal upgrade-modal" onClick={(e) => e.stopPropagation()}>
          <div className="upgrade-hero success">
            <div className="eyebrow">{t('Premium active')}</div>
            <h2>🎉 {t('You are already a Premium user!')}</h2>
            <p>{t('Enjoy unlimited passwords and cloud sync.')}</p>
            <button className="btn-primary" onClick={onClose}>{t('Close')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-hero">
          <div className="eyebrow">{t('Secure upgrade')}</div>
          <h2>{t('Unlock Premium')}</h2>
          <p className="modal-sub">{t('Unlimited vault entries and cloud sync for {{price}}', { price: PREMIUM_PRICE })}</p>
          <div className="price-badge">
            <span>{PREMIUM_PRICE}</span>
            <small>{t('6 months of sync + updates')}</small>
          </div>
        </div>

        <div className="activation-card">
          <div className="section-heading">
            <span className="pill">{t('Step 1')}</span>
            <div>
              <div className="section-title">{t('Continue with Google')}</div>
              <div className="section-sub">{t('Sign in to verify your plan and unlock cloud storage.')}</div>
            </div>
          </div>
          <div className="email-capture">
            <label>{t('Account')}</label>
            <div className="input-with-button">
              <input
                type="text"
                value={appAccount?.email ? t('Signed in as {{email}}', { email: appAccount.email }) : t('Not signed in')}
                readOnly
                aria-readonly="true"
                className="ltr-input"
              />
              {appAccount?.email ? (
                <button className="btn-secondary" onClick={handleAuthLogout} disabled={authBusy}>
                  {t('Sign out')}
                </button>
              ) : (
                <button className="btn-secondary" onClick={handleAuthLogin} disabled={authBusy}>
                  {authBusy ? t('Connecting...') : t('Continue with Google')}
                </button>
              )}
            </div>
          </div>
          {authError && <p className="help-text error-text">{authError}</p>}
        </div>

        <div className="payment-section">
          <div className="section-heading">
            <span className="pill">{t('Step 2')}</span>
            <div>
              <div className="section-title">{t('Pay using the QR that suits you')}</div>
              <div className="section-sub">{t('Scan the QR with your phone to complete payment.')}</div>
            </div>
          </div>
          <div className="pay-grid modern">
            <div className="card pay-card glass paypal">
              <div className="pay-card__header">
                <div className="brand">
                  <img
                    src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
                    alt={t('Credit Card')}
                    className="brand-logo"
                  />
                  <span className="brand-sub">{t('Scan to pay')}</span>
                </div>
                <span className="pill outline">{t('Instant')}</span>
              </div>
              <div className="qr-wrap elevated">
                <img
                  src={PAYPAL_QR_PATH}
                  alt={t('Credit Card')}
                  onError={(e:any)=>{ e.currentTarget.style.opacity = 0.4 }}
                />
              </div>
              <div className="pay-note">
                {t('Scan with your phone to pay.')}
              </div>
            </div>

            <div className="card pay-card glass crypto">
              <div className="pay-card__header">
                <div className="brand">
                  <div className="crypto-badge">USDT · BSC</div>
                  <span className="brand-sub">{t('Send 15 USDT (BEP20)')}</span>
                </div>
                <button className="ghost-btn" onClick={copyCryptoAddress}>{t('Copy address')}</button>
              </div>
              <div className="qr-wrap elevated">
                <img
                  src={CRYPTO_QR_URL}
                  alt="USDT BSC QR"
                />
              </div>
              <div className="pay-note">
                <div className="address-row">
                  <code className="ltr-input">{CRYPTO_ADDRESS_USDT_BSC}</code>
                  <button className="ghost-btn" onClick={copyCryptoAddress}>{t('Copy')}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

          <div className="activation-card">
            <div className="section-heading">
              <span className="pill accent">{t('Step 3')}</span>
              <div>
                <div className="section-title">{t('Request activation after payment')}</div>
                <div className="section-sub">{t('Share your email, then paste your license key to unlock Premium.')}</div>
              </div>
            </div>
          <div className="activation-fields">
            <div className="email-capture subtle">
              <label>{t('Install ID (for support)')}</label>
              <div className="input-with-button">
                <input type="text" value={installId} readOnly className="ltr-input" />
                <button className="ghost-btn" onClick={copyInstallId}>{t('Copy')}</button>
              </div>
            </div>
            <div className="email-capture">
              <label>{t('Payment Method')}</label>
              <select
                className="payment-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'paypal' | 'crypto')}
              >
                <option value="paypal">{t('Credit Card')}</option>
                <option value="crypto">{t('Crypto (USDT)')}</option>
              </select>
            </div>
            <div className="email-capture">
              <label>{t('Your Email (for activation)')}</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={userEmail}
                onChange={(e)=>setUserEmail(e.target.value)}
                className="ltr-input"
                autoFocus
              />
            </div>
            <div className="email-capture">
              <label>{t('License Key')}</label>
              <input
                type="text"
                placeholder={t('Enter license key')}
                value={licenseKey}
                onChange={(e)=>setLicenseKey(e.target.value)}
                className="ltr-input"
              />
            </div>
          </div>
          <div className="activation-actions">
            <button className="btn-secondary" disabled={sending || sent} onClick={requestActivation}>
              {sent ? t('Request Sent') : sending ? t('Sending...') : t('Request Activation')}
            </button>
            <button className="btn-primary" onClick={redeemLicenseKey} disabled={redeeming}>
              {redeeming ? t('Redeeming...') : t('Redeem Key')}
            </button>
            <button className="btn-secondary ghost" onClick={onClose}>{t('Close')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
