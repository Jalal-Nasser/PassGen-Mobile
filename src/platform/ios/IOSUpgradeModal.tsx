import { useEffect, useState } from 'react'
import { checkPremiumStatus, getSubscriptionOfferings, purchasePackage } from '../../services/revenuecat'
import { useI18n } from '../../services/i18n'
import type { UpgradeModalProps } from '../shared/upgradeTypes'
import '../../components/UpgradeModal.css'

export default function IOSUpgradeModal({ open, onClose }: UpgradeModalProps) {
  const { t } = useI18n()
  const [offerings, setOfferings] = useState<any>(null)
  const [offeringsLoaded, setOfferingsLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [premiumStatus, setPremiumStatus] = useState<'pro' | 'cloud' | 'free'>('free')

  useEffect(() => {
    if (!open) return
    setOfferings(null)
    setOfferingsLoaded(false)
    checkPremiumStatus().then(setPremiumStatus).catch(() => setPremiumStatus('free'))
    getSubscriptionOfferings()
      .then((offs) => {
        if (offs) setOfferings(offs)
        setOfferingsLoaded(true)
      })
      .catch(() => {
        setOfferingsLoaded(true)
      })
  }, [open])

  const handlePurchase = async (pkg: any) => {
    try {
      setBusy(true)
      await purchasePackage(pkg)
      const status = await checkPremiumStatus()
      if (status !== 'free') {
        setPremiumStatus(status)
        alert(t('Purchase successful! Premium unlocked.'))
        onClose()
      }
    } catch (err: any) {
      if (err.code !== 1) alert(t('Purchase failed: {{msg}}', { msg: err.message }))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  if (premiumStatus !== 'free') {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal upgrade-modal" onClick={(e) => e.stopPropagation()}>
          <div className="upgrade-hero success">
            <div className="eyebrow">{t('Premium active')}</div>
            <h2>{t('You are already a Premium user!')}</h2>
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
          <div className="eyebrow">{t('PassGen Premium')}</div>
          <h2>{t('Unlock Premium Features')}</h2>
          <p className="modal-sub">{t('Unlimited passwords, cloud backup, and advanced security.')}</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          {!offeringsLoaded && <p style={{ textAlign: 'center' }}>{t('Loading plans...')}</p>}
          {offeringsLoaded && !offerings && (
            <p style={{ textAlign: 'center' }}>
              {t('App Store plans are unavailable. Check the RevenueCat iOS API key, default offering, and App Store Connect product IDs.')}
            </p>
          )}
          {offerings && offerings.availablePackages.map((pkg: any) => (
            <button
              key={pkg.identifier}
              type="button"
              className="method-option"
              onClick={() => handlePurchase(pkg)}
              disabled={busy}
              style={{ marginBottom: '10px', width: '100%' }}
            >
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{pkg.product.title}</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{pkg.product.description}</div>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                {pkg.product.priceString}
              </div>
            </button>
          ))}
        </div>

        <div className="actions" style={{ marginTop: '20px' }}>
          <button className="btn-secondary ghost" onClick={onClose}>{t('Cancel')}</button>
        </div>
      </div>
    </div>
  )
}
