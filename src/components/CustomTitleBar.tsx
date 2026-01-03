import React, { useState } from 'react'
import './CustomTitleBar.css'
import { useI18n } from '../services/i18n'

interface CustomTitleBarProps {
  title?: string
}

export const CustomTitleBar: React.FC<CustomTitleBarProps> = ({ title = 'PassGen' }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const { t } = useI18n()

  const handleMinimize = () => {
    (window as any).electronAPI?.minimize()
  }

  const handleMaximize = () => {
    (window as any).electronAPI?.maximize()
  }

  const handleClose = () => {
    (window as any).electronAPI?.close()
  }

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu)
  }

  const closeMenus = () => {
    setActiveMenu(null)
  }

  const sendHelpAction = (channel: string) => {
    closeMenus()
    ;(window as any).electronAPI?.emit?.(channel)
  }

  return (
    <div className="custom-title-bar">
      <div className="title-bar-left">
        <div className="app-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" fill="currentColor"/>
            <path d="M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="white"/>
          </svg>
        </div>
        <span className="app-title">{title}</span>

        <div className="menu-bar">
          <div className="menu-item">
            <button
              className={`menu-button ${activeMenu === 'file' ? 'active' : ''}`}
              onClick={() => toggleMenu('file')}
            >
              {t('File')}
            </button>
            {activeMenu === 'file' && (
              <>
                <div className="menu-overlay" onClick={closeMenus}></div>
                <div className="menu-dropdown">
                  <button className="menu-dropdown-item" onClick={() => { closeMenus(); window.dispatchEvent(new CustomEvent('vault-import')); }}>
                    <span>{t('Open Vault Backup')}</span>
                    <span className="shortcut">Ctrl+O</span>
                  </button>
                  <button className="menu-dropdown-item" onClick={() => { closeMenus(); window.dispatchEvent(new CustomEvent('vault-export')); }}>
                    <span>{t('Save Vault Backup')}</span>
                    <span className="shortcut">Ctrl+S</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="menu-dropdown-item" onClick={() => { closeMenus(); window.dispatchEvent(new Event('open-settings')); }}>
                    <span>{t('Settings')}</span>
                    <span className="shortcut">Ctrl+,</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="menu-dropdown-item" onClick={() => { closeMenus(); handleClose(); }}>
                    <span>{t('Exit')}</span>
                    <span className="shortcut">Alt+F4</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="menu-item">
            <button
              className={`menu-button ${activeMenu === 'view' ? 'active' : ''}`}
              onClick={() => toggleMenu('view')}
            >
              {t('View')}
            </button>
            {activeMenu === 'view' && (
              <>
                <div className="menu-overlay" onClick={closeMenus}></div>
                <div className="menu-dropdown">
                  <button className="menu-dropdown-item" onClick={closeMenus}>
                    <span>{t('Reload')}</span>
                    <span className="shortcut">Ctrl+R</span>
                  </button>
                  <button className="menu-dropdown-item" onClick={closeMenus}>
                    <span>{t('Toggle DevTools')}</span>
                    <span className="shortcut">F12</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="menu-dropdown-item" onClick={closeMenus}>
                    <span>{t('Actual Size')}</span>
                    <span className="shortcut">Ctrl+0</span>
                  </button>
                  <button className="menu-dropdown-item" onClick={closeMenus}>
                    <span>{t('Zoom In')}</span>
                    <span className="shortcut">Ctrl++</span>
                  </button>
                  <button className="menu-dropdown-item" onClick={closeMenus}>
                    <span>{t('Zoom Out')}</span>
                    <span className="shortcut">Ctrl+-</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="menu-item">
            <button
              className={`menu-button ${activeMenu === 'help' ? 'active' : ''}`}
              onClick={() => toggleMenu('help')}
            >
              {t('Help')}
            </button>
            {activeMenu === 'help' && (
              <>
                <div className="menu-overlay" onClick={closeMenus}></div>
                <div className="menu-dropdown">
                  <button className="menu-dropdown-item" onClick={() => sendHelpAction('help:documentation')}>
                    <span>{t('Documentation')}</span>
                  </button>
                  <button className="menu-dropdown-item" onClick={() => sendHelpAction('help:shortcuts')}>
                    <span>{t('Keyboard Shortcuts')}</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="menu-dropdown-item" onClick={() => sendHelpAction('help:check-updates')}>
                    <span>{t('Check for Updates')}</span>
                  </button>
                  <button className="menu-dropdown-item" onClick={() => sendHelpAction('help:releases')}>
                    <span>{t('GitHub Releases')}</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="menu-dropdown-item" onClick={() => sendHelpAction('help:about')}>
                    <span>{t('About PassGen')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="title-bar-right">
        <button className="title-bar-button minimize-btn" onClick={handleMinimize} title={t('Minimize')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M0 6h12" stroke="currentColor" strokeWidth="1"/>
          </svg>
        </button>
        <button className="title-bar-button maximize-btn" onClick={handleMaximize} title={t('Maximize')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1"/>
          </svg>
        </button>
        <button className="title-bar-button close-btn" onClick={handleClose} title={t('Close')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
