import './UpgradeModal.css'
import './SettingsModal.css'
import { useI18n } from '../services/i18n'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t, language, setLanguage } = useI18n()
  const openPremiumSignIn = () => {
    onClose()
    window.dispatchEvent(new Event('open-storage-setup'))
  }
  const openPremiumUpgrade = () => {
    onClose()
    window.dispatchEvent(new Event('open-upgrade'))
  }
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('Settings')}</h2>
        <div className="settings-section">
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
        <div className="settings-section">
          <label>{t('Premium Access')}</label>
          <div className="settings-premium-card">
            <div className="settings-premium-option">
              <div className="settings-premium-title">{t('Already Premium?')}</div>
              <div className="settings-premium-sub">{t('Sign in with Google to unlock cloud storage.')}</div>
              <button className="btn-secondary settings-google-btn" onClick={openPremiumSignIn}>
                <img src="./google-g.svg" alt="Google" />
                {t('Continue with Google')}
              </button>
            </div>
            <div className="settings-premium-option">
              <div className="settings-premium-title">{t('Become Premium')}</div>
              <div className="settings-premium-sub">{t('Request activation after payment to unlock Premium.')}</div>
              <button className="btn-secondary" onClick={openPremiumUpgrade}>
                {t('Request Activation')}
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
