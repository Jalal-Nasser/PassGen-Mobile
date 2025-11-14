import { useEffect, useRef, useState } from 'react'
import { ConfigStore } from '../services/configStore'
import './UpgradeModal.css'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
}

const PREMIUM_PRICE = '$3.99/mo'

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const store = new ConfigStore()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [installId, setInstallId] = useState<string>('')
  const showTestVerify =
    ((import.meta as any)?.env?.DEV as boolean) ||
    (typeof window !== 'undefined' && window.location?.origin?.includes('localhost')) ||
    (typeof window !== 'undefined' && localStorage.getItem('passgen-show-test') === '1')

  useEffect(() => {
    // Attempt to render PayPal buttons if SDK is present
    // The user provided container id
    if (open && (window as any).paypal && document.getElementById('paypal-container-DL5XTW4XNFAZ2')) {
      try {
        // If PayPal SDK is loaded externally, buttons may auto-render to this container
      } catch {}
    }
    if (open) {
      const stored = localStorage.getItem('passgen-qr')
      if (stored) setQrDataUrl(stored)
      setInstallId(store.getInstallId())
    }
  }, [open])

  const [userEmail, setUserEmail] = useState(store.getUserEmail())
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
      const res = await window.electron.payment.requestActivation({ email: userEmail, requestId })
      if (res.success) {
        setSent(true)
        alert('Activation request sent. You will be activated after verification.')
      } else {
        alert(res.error || 'Opened mail client for manual send.')
      }
    } catch (e:any) {
      alert('Failed to send activation request: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  const [code, setCode] = useState('')
  const [testResult, setTestResult] = useState<string>('')
  const activateWithCode = () => {
    if (!code) { alert('Enter activation code'); return }
    if (!userEmail) { alert('Enter your email first'); return }
    if (store.verifyActivationCode(code, userEmail)) {
      store.setPremium(true)
      onClose()
      alert('Premium activated. Enjoy!')
    } else {
      alert('Invalid activation code.')
    }
  }

  const testVerify = () => {
    if (!code || !userEmail) { setTestResult('Enter email and code'); return }
    const ok = store.verifyActivationCode(code, userEmail)
    setTestResult(ok ? '✓ Code matches (dev test)' : '✗ Code does not match')
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal clean" onClick={(e) => e.stopPropagation()}>
        <h2>Unlock Premium</h2>
        <p className="modal-sub">Get unlimited passwords and cloud sync for {PREMIUM_PRICE}</p>

        <ul className="benefits compact">
          <li>Unlimited entries (free includes 4)</li>
          <li>Cloud sync: Google Drive, AWS S3, DigitalOcean</li>
        </ul>

        <div className="pay-grid">
          <div className="card pay-card">
            <div className="card-title">PayPal</div>
            <form
              action="https://www.paypal.com/ncp/payment/DL5XTW4XNFAZ2"
              method="post"
              target="_blank"
              className="pay-form"
            >
              <input className="pp-DL5XTW4XNFAZ2" type="submit" value="Buy Now" />
              <img
                src="https://www.paypalobjects.com/images/Debit_Credit_APM.svg"
                alt="cards"
                className="cards"
              />
              <section className="pay-powered">
                <span>Powered by</span>
                <img
                  src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
                  alt="paypal"
                  className="paypal-wordmark"
                />
              </section>
            </form>
          </div>

          <div className="card qr-card">
            <div className="card-title">Pay via QR</div>
            <div className="qr-wrap" onClick={()=>fileInputRef.current?.click()} title="Click to upload your QR image">
              <img
                src={qrDataUrl || '/qr.png'}
                alt="Payment QR"
                onError={(e:any)=>{ e.currentTarget.style.opacity = 0.4 }}
              />
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={(ev)=>{
              const file = ev.target.files?.[0]
              if (!file) return
              const fr = new FileReader()
              fr.onload = () => { const data = String(fr.result); localStorage.setItem('passgen-qr', data); setQrDataUrl(data) }
              fr.readAsDataURL(file)
            }} />
            <small className="hint">Click the QR to upload your code (optional)</small>
          </div>
        </div>

        <div className="activation-panel">
          <div className="email-capture" style={{opacity:0.8}}>
            <label>Install ID (for support):</label>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="text" value={installId} readOnly style={{flex:1}} />
              <button className="btn-secondary" onClick={()=>{ navigator.clipboard?.writeText(installId) }}>Copy</button>
            </div>
          </div>
          <div className="email-capture">
            <label>Your Email (for activation):</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={userEmail}
              onChange={(e)=>setUserEmail(e.target.value)}
            />
          </div>
          <div className="email-capture">
            <label>Activation Code:</label>
            <input
              type="text"
              placeholder="Enter code from seller"
              value={code}
              onChange={(e)=>setCode(e.target.value)}
            />
          </div>
          <div className="activation-actions">
            <button className="btn-secondary" disabled={sending || sent} onClick={requestActivation}>
              {sent ? 'Request Sent' : sending ? 'Sending...' : 'Request Activation'}
            </button>
            <button className="btn-primary" onClick={activateWithCode}>Activate</button>
            {showTestVerify && (
              <button className="btn-secondary" onClick={testVerify}>Test Verify (dev)</button>
            )}
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
          {showTestVerify && testResult && (
            <div style={{marginTop:8, opacity:0.8}}>{testResult}</div>
          )}
        </div>
      </div>
    </div>
  )
}
