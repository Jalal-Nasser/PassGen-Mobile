import './UpgradeModal.css'

interface TermsModalProps {
  open: boolean
  onClose: () => void
}

export default function TermsModal({ open, onClose }: TermsModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <h2>Terms of Service</h2>
        <p className="modal-sub">Please read these basics before using PassGen.</p>
        <ul className="benefits">
          <li>Zero-knowledge: Your master password never leaves your device.</li>
          <li>Local-first: Data is encrypted on-device before any storage.</li>
          <li>Free plan: up to 4 password entries.</li>
          <li>Premium plan: unlimited entries and cloud providers.</li>
          <li>You are responsible for keeping your master password safe. It cannot be recovered.</li>
        </ul>
        <div className="actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
