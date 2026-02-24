import { useEffect, useState } from 'react'
import { ConfigStore } from '../services/configStore'
import { applyRemoteLicense } from '../services/license'
import { copyText } from '../services/clipboard'
import { Capacitor } from '@capacitor/core'
import { purchasePackage, getSubscriptionOfferings, checkPremiumStatus } from '../services/revenuecat'
import './UpgradeModal.css'
import { useI18n } from '../services/i18n'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
}

const PAYMENT_PAGE_BASE_URL = 'https://git.mdeploy.dev/passgen'

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const store = new ConfigStore()
  const { t } = useI18n()
  const [installId, setInstallId] = useState<string>('')
  const [offerings, setOfferings] = useState<any>(null)
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    if (open) {
      setInstallId(store.getInstallId())
      if (isNative) {
        getSubscriptionOfferings().then((offs) => {
          if (offs) setOfferings(offs)
        })
      }
    }
  }, [open, isNative])

  const [licenseKey, setLicenseKey] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [activationEmail, setActivationEmail] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  const redeemLicenseKey = async () => {
    if (!licenseKey) { alert(t('Enter license key')); return }
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
    } catch (e: any) {
      alert(t('License redeem failed: {{message}}', { message: e.message }))
    } finally {
      setRedeeming(false)
    }
  }

  const redeemActivationCode = () => {
    if (!activationCode) { alert(t('Enter activation code')); return }
    if (!activationEmail) { alert(t('Enter activation email')); return }

    if (store.verifyActivationCode(activationCode, activationEmail)) {
      store.setUserEmail(activationEmail)
      store.setPremium(true)
      onClose()
      alert(t('Premium activated locally. Enjoy!'))
    } else {
      alert(t('Invalid activation code for this device or email'))
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

  const buildPaymentUrl = () => {
    const params = new URLSearchParams()
    if (installId) params.set('installId', installId)
    const query = params.toString()
    return `${PAYMENT_PAGE_BASE_URL}${query ? `?${query}` : ''}#pricing`
  }

  const openPaymentPage = async () => {
    const api = (window as any).electronAPI
    try {
      const paymentUrl = buildPaymentUrl()
      if (api?.openExternal) {
        await api.openExternal(paymentUrl)
      } else {
        window.open(paymentUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error: any) {
      alert(t('Failed to open payment page: {{message}}', { message: error?.message || 'Unknown error' }))
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

  if (isNative) {
    const handlePurchase = async (pkg: any) => {
      try {
        setRedeeming(true)
        await purchasePackage(pkg)
        const status = await checkPremiumStatus()
        if (status !== 'free') {
          store.setPremium(true)
          alert(t('Purchase successful! Premium unlocked.'))
          onClose()
        }
      } catch (err: any) {
        if (err.code !== 1) alert(t('Purchase failed: {{msg}}', { msg: err.message }))
      } finally {
        setRedeeming(false)
      }
    }

    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal upgrade-modal" onClick={(e) => e.stopPropagation()}>
          <div className="upgrade-hero">
            <div className="eyebrow">{t('PassGen Premium')}</div>
            <h2>{t('Unlock Premium Features')}</h2>
            <p className="modal-sub">{t('Unlimited passwords, cloud backup, and advanced security.')}</p>
          </div>

          <div className="activation-card" style={{ marginTop: '20px' }}>
            {!offerings && <p style={{ textAlign: 'center' }}>{t('Loading plans...')}</p>}
            {offerings && offerings.availablePackages.map((pkg: any) => (
              <div key={pkg.identifier} className="method-option" onClick={() => handlePurchase(pkg)} style={{ marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{pkg.product.title}</div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{pkg.product.description}</div>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                  {pkg.product.priceString}
                </div>
              </div>
            ))}
          </div>

          <div className="actions" style={{ marginTop: '20px' }}>
            <button className="btn-secondary ghost" onClick={onClose}>{t('Cancel')}</button>
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
          <p className="modal-sub">{t('Unlimited vault entries and cloud sync.')}</p>
        </div>

        <div className="activation-card">
          <div className="section-heading">
            <span className="pill">{t('Step 1')}</span>
            <div>
              <div className="section-title">{t('Install ID')}</div>
              <div className="section-sub">{t('Copy your Install ID, then pick a plan on the payment page.')}</div>
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
          </div>
          <div className="activation-actions">
            <button className="btn-primary" onClick={openPaymentPage}>
              {t('Pick a Plan')}
            </button>
          </div>
        </div>

        <div className="activation-card">
          <div className="section-heading">
            <span className="pill accent">{t('Step 2')}</span>
            <div>
              <div className="section-title">{t('Enter license key')}</div>
              <div className="section-sub">{t('Paste the license key from your payment confirmation to unlock Premium.')}</div>
            </div>
          </div>
          <div className="activation-fields">
            <div className="email-capture">
              <label>{t('License Key')}</label>
              <input
                type="text"
                placeholder={t('Enter license key')}
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="ltr-input"
              />
            </div>
          </div>
          <div className="activation-actions">
            <button className="btn-primary" onClick={redeemLicenseKey} disabled={redeeming}>
              {redeeming ? t('Redeeming...') : t('Redeem Key')}
            </button>
          </div>
        </div>

        <div className="activation-card">
          <div className="section-heading">
            <span className="pill warning">{t('Step 3')}</span>
            <div>
              <div className="section-title">{t('Support Activation')}</div>
              <div className="section-sub">{t('Admins: Paste both the Email and Code from the dashboard.')}</div>
            </div>
          </div>
          <div className="activation-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="email-capture">
              <label>{t('Email')}</label>
              <input
                type="email"
                placeholder={t('user@example.com')}
                value={activationEmail}
                onChange={(e) => setActivationEmail(e.target.value)}
                className="ltr-input"
              />
            </div>
            <div className="email-capture">
              <label>{t('Activation Code')}</label>
              <input
                type="text"
                placeholder={t('Enter 10-char code')}
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                className="ltr-input"
              />
            </div>
          </div>
          <div className="activation-actions">
            <button className="btn-primary" onClick={redeemActivationCode}>
              {t('Activate')}
            </button>
            <button className="btn-secondary ghost" onClick={onClose}>{t('Close')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
