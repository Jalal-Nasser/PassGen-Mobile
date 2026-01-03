
import { useI18n } from '../services/i18n'

function AppFooter() {
  const year = 2026
  const { t, language, setLanguage } = useI18n()

  return (
    <footer className="app-footer">
      <div className="footer-payments" aria-label="Supported payment methods">
        <div className="footer-payment-card">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
            alt="Mastercard"
          />
        </div>
        <div className="footer-payment-card">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
            alt="Visa"
          />
        </div>
        <div className="footer-payment-card">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Apple_Pay_logo.svg"
            alt="Apple Pay"
          />
        </div>
        <div className="footer-payment-card">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg"
            alt="Google Pay"
          />
        </div>
      </div>
      <span className="footer-line">
        © {year} PassGen · {t('Developer')}: <a href="https://github.com/Jalal-Nasser" target="_blank" rel="noopener noreferrer">JalalNasser</a> · {t('Deployed by')}: <a href="https://mdeploy.dev" target="_blank" rel="noopener noreferrer">mDeploy</a>
        {' '}· <a href="#" onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new Event('open-terms'))}}>{t('Terms')}</a>
        {' '}· <span className="footer-lang">
          {t('Language')}:{' '}
          <select
            className="footer-lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'ar')}
          >
            <option value="en">{t('English')}</option>
            <option value="ar">{t('Arabic')}</option>
          </select>
        </span>
      </span>
    </footer>
  )
}

export default AppFooter
