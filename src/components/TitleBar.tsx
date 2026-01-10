import { useState } from 'react'
import './TitleBar.css'

interface TitleBarProps {
  onResetApp: () => void
  onOpenUpgrade: () => void
  onOpenTerms: () => void
  onCheckUpdates: () => void
  isPremium?: boolean
}

function TitleBar({ onResetApp, onOpenUpgrade, onCheckUpdates, onOpenTerms, isPremium = false }: TitleBarProps) {
  const [showMenu, setShowMenu] = useState(false)

  const openAbout = () => {
    const version = '1.0.3' // Will be dynamic later
    const msg = `PassGen\nVersion ${version}\n\nA secure password generator and vault.\nDeveloper: JalalNasser\nPremium: $3.99/mo for cloud sync and unlimited items.`
    if (window.confirm(msg + '\n\nOpen downloads page?')) {
      window.open('https://github.com/mDeploys/PassGen/releases', '_blank')
    }
    setShowMenu(false)
  }

  const openDownloads = () => {
    window.open('https://github.com/mDeploys/PassGen/releases', '_blank')
    setShowMenu(false)
  }

  const openIssues = () => {
    window.open('https://github.com/mDeploys/PassGen/issues', '_blank')
    setShowMenu(false)
  }

  return (
    <div className="title-bar">
      <div className="title-bar-left">
        <div className="app-icon">🔐</div>
        <span className="app-name">PassGen</span>
      </div>

      <div className="title-bar-center">
        <button className="title-menu-btn" onClick={() => setShowMenu(!showMenu)}>
          ☰ Menu
        </button>
        {showMenu && (
          <div className="title-menu-dropdown">
            {!isPremium && <button onClick={onOpenUpgrade}>⭐ Upgrade to Premium</button>}
            <button onClick={onCheckUpdates}>🔄 Check for Updates</button>
            <button onClick={openAbout}>ℹ️ About PassGen</button>
            <button onClick={openDownloads}>📥 Downloads</button>
            <button onClick={openIssues}>🐛 Report Issue</button>
            <button onClick={onOpenTerms}>📄 Terms (EULA)</button>
            <div className="menu-divider"></div>
            <button onClick={onResetApp} className="danger">↺ Reset App</button>
          </div>
        )}
      </div>

      <div className="title-bar-right">
        <button className="title-btn" onClick={() => (window as any).electronAPI?.minimize?.()}>−</button>
        <button className="title-btn" onClick={() => (window as any).electronAPI?.maximize?.()}>□</button>
        <button className="title-btn close" onClick={() => (window as any).electronAPI?.close?.()}>✕</button>
      </div>
    </div>
  )
}

export default TitleBar
