
import { useState, useEffect } from 'react'
import { ConfigStore } from '../services/configStore'
import { useI18n } from '../services/i18n'

function AppFooter() {
  const year = 2026
  const [checking, setChecking] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string|null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const store = new ConfigStore()
  const { t } = useI18n()

  useEffect(() => {
    const syncPremium = () => setIsPremium(store.isPremium())
    syncPremium()
    window.addEventListener('premium-changed', syncPremium)
    return () => window.removeEventListener('premium-changed', syncPremium)
  }, [store])

  const checkForUpdate = async () => {
    setChecking(true)
    setUpdateMsg(null)
    try {
      const res = await fetch('https://api.github.com/repos/Jalal-Nasser/PassGen/releases/latest')
      if (!res.ok) throw new Error(t('Failed to fetch release info'))
      const data = await res.json()
      const latest = data.tag_name?.replace(/^v/, '')
      const url = data.html_url
      // @ts-ignore
      const current = (window as any).appVersion || (import.meta as any)?.env?.npm_package_version || '1.0.0'
      const parse = (v:string)=>{
        const m = (v||'0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/)
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0,0,0]
      }
      const newer = (a:string,b:string)=>{
        const [A1,A2,A3] = parse(a), [B1,B2,B3] = parse(b)
        if (A1!==B1) return A1>B1
        if (A2!==B2) return A2>B2
        return A3>B3
      }
      if (latest && newer(latest, current)) {
        setUpdateMsg(t('New version {{version}} available!', { version: latest }) + ' ' + url)
        if (window.confirm(t('A new version ({{version}}) is available!\n\nGo to download page?', { version: latest }))) {
          window.open(url, '_blank')
        }
      } else {
        setUpdateMsg(t('You have the latest version.'))
      }
    } catch (e:any) {
      setUpdateMsg(t('Update check failed: {{message}}', { message: e.message }))
    } finally {
      setChecking(false)
    }
  }

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
        {' '}· <a href="#" onClick={(e)=>{e.preventDefault(); checkForUpdate()}}>{checking ? t('Checking...') : t('Check for Updates')}</a>
        {' '}· {isPremium ? t('Premium member') : t('Free: 4 passwords')}
      </span>
      {updateMsg && <div style={{marginTop:4, fontSize:13, color:'#4a4'}}>{updateMsg}</div>}
    </footer>
  )
}

export default AppFooter
