import { useState, useEffect } from 'react'
import { PasswordEntry } from '../services/encryption'
import { StorageManager } from '../services/storageManager'
import './PasswordVault.css'
import { copyText } from '../services/clipboard'
import { ConfigStore } from '../services/configStore'
import { getEntryLimit, getPremiumTier } from '../services/license'
import { useI18n } from '../services/i18n'

interface PasswordVaultProps {
  storageManager: StorageManager
  onGenerateNew: () => void
}

function PasswordVault({ storageManager, onGenerateNew }: PasswordVaultProps) {
  const { t, language } = useI18n()
  const [entries, setEntries] = useState<PasswordEntry[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PasswordEntry | null>(null)
  const [newEntry, setNewEntry] = useState({
    name: '',
    username: '',
    password: '',
    url: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sessionToken, setSessionToken] = useState<string>('')
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [copyMessage, setCopyMessage] = useState('')
  const [copyMessageType, setCopyMessageType] = useState<'ok' | 'error' | ''>('')
  const [providerLabel, setProviderLabel] = useState(storageManager.getCurrentProvider())
  const [premiumTier, setPremiumTier] = useState(getPremiumTier())
  const store = new ConfigStore()

  useEffect(() => {
    loadEntries()
    ;(async () => {
      try {
        const label = await storageManager.refreshProviderStatus()
        setProviderLabel(label)
      } catch {}
    })()
    // Expose helpers for main process bridge
    ;(window as any).__passgen_listEntries = async () => {
      try { return await storageManager.getAllPasswordEntries() } catch { return [] }
    }
    ;(window as any).__passgen_getEntryById = async (id: string) => {
      try {
        const all = await storageManager.getAllPasswordEntries()
        const e = all.find(x => x.id === id)
        if (!e) return null
        return { username: e.username, password: e.password }
      } catch { return null }
    }
    // Fetch session token for extension pairing
    ;(async () => {
      try {
        const token = await (window as any).electronAPI?.getSessionToken?.()
        if (typeof token === 'string') setSessionToken(token)
      } catch {}
    })()
    // Close dropdown when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
          (menu as HTMLElement).style.display = 'none'
        })
      }
    }
    document.addEventListener('click', handleClickOutside)

    // Listen for vault import/export events from menu
    const handleVaultExport = () => handleExport()
    const handleVaultImport = () => handleImport()
    window.addEventListener('vault-export', handleVaultExport as EventListener)
    window.addEventListener('vault-import', handleVaultImport as EventListener)

    return () => {
      document.removeEventListener('click', handleClickOutside)
      window.removeEventListener('vault-export', handleVaultExport as EventListener)
      window.removeEventListener('vault-import', handleVaultImport as EventListener)
    }
  }, [])

  useEffect(() => {
    const handlePremiumChange = () => setPremiumTier(getPremiumTier())
    window.addEventListener('premium-changed', handlePremiumChange)
    return () => window.removeEventListener('premium-changed', handlePremiumChange)
  }, [])

  const loadEntries = async () => {
    try {
      setLoading(true)
      const loadedEntries = await storageManager.getAllPasswordEntries()
      setEntries(loadedEntries)
      const label = await storageManager.refreshProviderStatus()
      setProviderLabel(label)
    } catch (error) {
      console.error('Failed to load entries:', error)
      alert(t('Failed to load passwords: {{message}}', { message: (error as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!copyMessage) return
    const t = setTimeout(() => {
      setCopyMessage('')
      setCopyMessageType('')
    }, 1800)
    return () => clearTimeout(t)
  }, [copyMessage])

  const repairVault = async () => {
    if (!confirm(t('Repair will remove unreadable items and migrate any plaintext records to encrypted form. Continue?'))) return
    try {
      setLoading(true)
      const summary = await storageManager.repairVault()
      await loadEntries()
      alert(t('Repair complete.\nTotal: {{total}}\nKept: {{kept}}\nMigrated: {{migrated}}\nRemoved: {{removed}}', {
        total: summary.total,
        kept: summary.kept,
        migrated: summary.migrated,
        removed: summary.removed
      }))
    } catch (e) {
      console.error('Repair failed:', e)
      alert(t('Repair failed: {{message}}', { message: (e as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (premiumTier === 'free') {
      alert(t('Export Vault Backup is a Premium feature. Upgrade to Premium to backup your vault.'))
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    try {
      setLoading(true)
      const data = await storageManager.exportVault()
      const api = (window as any).electronAPI
      if (api && api.saveVaultFile) {
        const result = await api.saveVaultFile(data)
        if (result.success) {
          alert(t('Vault backup exported successfully!'))
        } else {
          alert(t('Export canceled or failed: {{message}}', { message: result.error || '' }))
        }
      } else {
        // Fallback for web: download as file
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `passgen-vault-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
        alert(t('Vault backup downloaded!'))
      }
    } catch (e) {
      alert(t('Export failed: {{message}}', { message: (e as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (premiumTier === 'free') {
      alert(t('Import Vault Backup is a Premium feature. Upgrade to Premium to restore backups.'))
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (!confirm(t('Importing will replace your current vault. Make sure you have a backup! Continue?'))) return
    try {
      setLoading(true)
      const api = (window as any).electronAPI
      let data: string
      if (api && api.openVaultFile) {
        const result = await api.openVaultFile()
        if (!result.success) {
          alert(t('Import canceled or failed: {{message}}', { message: result.error || '' }))
          return
        }
        data = result.data
      } else {
        // Fallback for web: file input
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e: any) => {
          const file = e.target?.files?.[0]
          if (!file) return
          const text = await file.text()
          try {
            await storageManager.importVault(text)
            await loadEntries()
            alert(t('Vault imported successfully!'))
          } catch (err) {
            alert(t('Import failed: {{message}}', { message: (err as Error).message }))
          } finally {
            setLoading(false)
          }
        }
        input.click()
        return
      }
      await storageManager.importVault(data)
      await loadEntries()
      alert(t('Vault imported successfully!'))
    } catch (e) {
      alert(t('Import failed: {{message}}', { message: (e as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (entries.length === 0) {
      alert(t('No passwords to export'))
      return
    }
    const csvHeader = 'Name,Username,Password,URL,Notes,Created At,Updated At\n'
    const csvRows = entries.map(entry =>
      `"${entry.name}","${entry.username || ''}","${entry.password}","${entry.url || ''}","${entry.notes || ''}","${entry.createdAt}","${entry.updatedAt}"`
    ).join('\n')
    const csvContent = csvHeader + csvRows
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'passwords.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSaveEntry = async () => {
    if (!newEntry.name || !newEntry.password) {
      alert(t('Name and password are required'))
      return
    }

    const limit = getEntryLimit(premiumTier)
    if (!isEditing && limit !== null && entries.length >= limit) {
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }

    try {
      setLoading(true)
      if (isEditing && editingEntry) {
        // Update existing entry
        const updatedEntry: PasswordEntry = {
          ...editingEntry,
          name: newEntry.name,
          password: newEntry.password,
          username: newEntry.username,
          url: newEntry.url,
          notes: newEntry.notes,
          updatedAt: new Date().toISOString(),
        }

        await storageManager.updatePasswordEntry(updatedEntry)
        alert(t('Password updated successfully!'))
      } else {
        // Save new entry
        const entry: PasswordEntry = {
          id: Date.now().toString(),
          name: newEntry.name,
          password: newEntry.password,
          username: newEntry.username,
          url: newEntry.url,
          notes: newEntry.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        await storageManager.savePasswordEntry(entry)
        alert(t('Password saved successfully!'))
      }

      // Reset form and reload entries
      setNewEntry({ name: '', username: '', password: '', url: '', notes: '' })
      setShowAddForm(false)
      setIsEditing(false)
      setEditingEntry(null)
      await loadEntries()
    } catch (error) {
      console.error('Failed to save entry:', error)
      alert(t('Failed to save password: {{message}}', { message: (error as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      const ok = await copyText(text)
      setCopyMessage(ok ? t('Copied to clipboard') : t('Failed to copy'))
      setCopyMessageType(ok ? 'ok' : 'error')
    } catch (err) {
      console.error('Copy failed:', err)
      setCopyMessage(t('Failed to copy'))
      setCopyMessageType('error')
    }
  }

  const handleEditEntry = (entry: PasswordEntry) => {
    setIsEditing(true)
    setEditingEntry(entry)
    setNewEntry({
      name: entry.name,
      username: entry.username || '',
      password: entry.password,
      url: entry.url || '',
      notes: entry.notes || '',
    })
    setShowAddForm(true)
  }

  const filteredEntries = entries.filter(entry =>
    entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.url?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleEntry = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entryId)) {
        newSet.delete(entryId)
      } else {
        newSet.add(entryId)
      }
      return newSet
    })
  }

  const handleSetupPasskey = async () => {
    try {
      setLoading(true)

      // Check if WebAuthn is supported
      if (!navigator.credentials || !navigator.credentials.create) {
        alert(t('Passkey is not supported on this device or browser'))
        return
      }

      // Check if we're in a secure context
      if (!window.isSecureContext) {
        alert(t('Passkey requires a secure context. This feature is not available in this mode.'))
        return
      }

      // Create passkey
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: 'PassGen' },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'passgen-user',
            displayName: 'PassGen User'
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          timeout: 60000,
          attestation: 'none'
        }
      })

      if (!credential) {
        alert(t('Passkey registration cancelled'))
        return
      }

      if (credential.type !== 'public-key') {
        alert(t('Invalid credential type received'))
        return
      }

      const credentialId = credential.id

      store.setPasskeyCredential(credentialId, 'passkey-registered')
      alert(t('Passkey setup successful! You can now unlock with your biometric.'))
    } catch (e) {
      const errorMsg = (e as Error).message
      if (errorMsg.includes('cancel') || errorMsg.includes('dismissed')) {
        alert(t('Passkey setup cancelled'))
      } else {
        alert(t('Passkey setup failed: {{message}}', { message: errorMsg }))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="password-vault">
      <div className="vault-header">
        <div className="header-left">
          <h2>{t('Password Vault')} {premiumTier !== 'free' && <span className="premium-badge">{t('Premium')}</span>}</h2>
        </div>
        <div className="vault-actions">
          <button onClick={onGenerateNew} className="btn-primary">
            {t('Generate')}
          </button>
          <button onClick={() => {
            setShowAddForm(!showAddForm)
            if (showAddForm) {
              // Canceling
              setIsEditing(false)
              setEditingEntry(null)
              setNewEntry({ name: '', username: '', password: '', url: '', notes: '' })
            }
          }} className={showAddForm ? "btn-secondary" : "btn-primary"}>
            {showAddForm ? t('Cancel') : t('Add New')}
          </button>
          <div className="dropdown">
            <button className="btn-secondary dropdown-toggle" onClick={(e) => {
              const menu = e.currentTarget.nextElementSibling as HTMLElement
              menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
            }}>
              {t('Actions')}
            </button>
            <div className="dropdown-menu">
              <button onClick={loadEntries} disabled={loading}>{t('Refresh')}</button>
              {((import.meta as any)?.env?.DEV as boolean) === true && (
                <button onClick={repairVault} disabled={loading}>{t('Repair Vault')}</button>
              )}
              <button onClick={() => window.dispatchEvent(new Event('open-storage-setup'))}>{t('Premium Access')}</button>
              <button onClick={() => window.dispatchEvent(new Event('open-storage-setup'))}>{t('Change Storage')}</button>
              <button onClick={handleSetupPasskey} disabled={loading}>{t('Setup Passkey')}</button>
              {premiumTier !== 'free' && (
                <>
                  <button onClick={handleExport} disabled={loading}>{t('Export Vault Backup')}</button>
                  <button onClick={handleImport} disabled={loading}>{t('Import Vault Backup')}</button>
                  <button onClick={exportToCSV}>{t('Export to CSV')}</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder={t('Search passwords...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {copyMessage && (
        <div className={`copy-toast ${copyMessageType === 'ok' ? 'copy-toast--ok' : 'copy-toast--error'}`}>
          {copyMessage}
        </div>
      )}

      {showAddForm && (
        <div className="add-form">
          <h3>{isEditing ? t('Edit Password') : t('Add New Password')}</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('Name *')}</label>
              <input
                type="text"
                value={newEntry.name}
                onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                placeholder={t('e.g., Gmail, Facebook')}
              />
            </div>
            <div className="form-group">
              <label>{t('Username/Email')}</label>
              <input
                type="text"
                value={newEntry.username}
                onChange={(e) => setNewEntry({ ...newEntry, username: e.target.value })}
                placeholder="user@example.com"
                className="ltr-input"
              />
            </div>
            <div className="form-group">
              <label>{t('Password *')}</label>
              <div className="password-input-group">
                <input
                  type="text"
                  value={newEntry.password}
                  onChange={(e) => setNewEntry({ ...newEntry, password: e.target.value })}
                  placeholder={t('Enter or generate password')}
                  className="ltr-input"
                />
                <button onClick={onGenerateNew} className="generate-inline-btn">
                  {t('Generate')}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>{t('URL')}</label>
              <input
                type="text"
                value={newEntry.url}
                onChange={(e) => setNewEntry({ ...newEntry, url: e.target.value })}
                placeholder="https://example.com"
                className="ltr-input"
              />
            </div>
            <div className="form-group full-width">
              <label>{t('Notes')}</label>
              <textarea
                value={newEntry.notes}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                placeholder={t('Additional notes...')}
                rows={3}
              />
            </div>
          </div>
          <button onClick={handleSaveEntry} className="save-btn" disabled={loading}>
            {loading ? t('Saving...') : (isEditing ? t('Update Password') : t('Save Password'))}
          </button>
        </div>
      )}

      <div className="entries-list">
        {loading && <div className="loading">{t('Loading...')}</div>}
        
        {!loading && filteredEntries.length === 0 && (
          <div className="empty-state">
            <p>{t('No passwords stored yet.')}</p>
            <p>{t('Click "Add Password" to get started!')}</p>
          </div>
        )}

        {!loading && filteredEntries.map(entry => {
          const isExpanded = expandedEntries.has(entry.id)
          return (
          <div key={entry.id} className={`password-entry ${isExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="entry-header" onClick={() => toggleEntry(entry.id)}>
              <button className="btn-expand" title={isExpanded ? t('Collapse') : t('Expand')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
              <div className="entry-title">
                <h3>{entry.name}</h3>
                {entry.url && (
                  <a href={entry.url} target="_blank" rel="noopener noreferrer" className="entry-url ltr-input" title={entry.url} onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      try {
                        return new URL(entry.url!).hostname.replace('www.', '')
                      } catch {
                        return entry.url
                      }
                    })()}
                  </a>
                  )}
                </div>
              <button onClick={(e) => { e.stopPropagation(); handleEditEntry(entry); }} className="btn-icon" title={t('Edit')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                </svg>
              </button>
            </div>

            {isExpanded && <div className="entry-fields">
              {entry.username && (
                <div className="field-row">
                  <div className="field-content">
                    <span className="field-label">{t('Username')}</span>
                    <span className="field-text ltr-input">{entry.username}</span>
                  </div>
                  <button onClick={() => copyToClipboard(entry.username!)} className="btn-copy" title={t('Copy username')}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                    </svg>
                  </button>
                </div>
              )}

              <div className="field-row">
                <div className="field-content">
                  <span className="field-label">{t('Password')}</span>
                  <span className="field-text password-hidden">••••••••</span>
                </div>
                <button onClick={() => copyToClipboard(entry.password)} className="btn-copy" title={t('Copy password')}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                  </svg>
                </button>
              </div>

              {entry.notes && (
                <div className="field-row notes-row">
                  <div className="field-content">
                    <span className="field-label">{t('Notes')}</span>
                    <span className="field-text notes-text">{entry.notes}</span>
                  </div>
                </div>
              )}
            </div>}

            {isExpanded && <div className="entry-footer">
              <span className="entry-date">{t('Added {{date}}', { date: new Date(entry.createdAt).toLocaleDateString(language) })}</span>
            </div>}
          </div>
        )}
        )}
      </div>

      <div className="vault-footer">
        <div className="footer-row">
          <span className="footer-label">{t('Storage Provider')}</span>
          <span className="footer-value">{providerLabel}</span>
        </div>
        {sessionToken && (
          <div className="footer-row session-token-row">
            <span className="footer-label">{t('Extension Token')}</span>
            <div className="token-container">
              <input type="text" readOnly value={sessionToken} className="token-input ltr-input" />
              <button className="btn-copy-small" onClick={async ()=>{ const ok = await copyText(sessionToken); if (!ok) alert(t('Failed to copy token')); }} title={t('Copy session token')}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                </svg>
              </button>
            </div>
          </div>
        )}
        <div className="footer-encryption">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ marginInlineEnd: '6px' }}>
            <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
          </svg>
          {t('All passwords are encrypted with your master password')}
        </div>
      </div>
    </div>
  )
}

export default PasswordVault
