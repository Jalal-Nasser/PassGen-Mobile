import { useState, useEffect } from 'react'
import { PasswordEntry } from '../services/encryption'
import { StorageManager } from '../services/storageManager'
import './PasswordVault.css'
import { copyText } from '../services/clipboard'
import { ConfigStore } from '../services/configStore'

interface PasswordVaultProps {
  storageManager: StorageManager
  onGenerateNew: () => void
}

function PasswordVault({ storageManager, onGenerateNew }: PasswordVaultProps) {
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
  const store = new ConfigStore()

  useEffect(() => {
    loadEntries()
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
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const loadEntries = async () => {
    try {
      setLoading(true)
      const loadedEntries = await storageManager.getAllPasswordEntries()
      setEntries(loadedEntries)
    } catch (error) {
      console.error('Failed to load entries:', error)
      alert('Failed to load passwords: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const repairVault = async () => {
    if (!confirm('Repair will remove unreadable items and migrate any plaintext records to encrypted form. Continue?')) return
    try {
      setLoading(true)
      const summary = await storageManager.repairVault()
      await loadEntries()
      alert(`Repair complete.\nTotal: ${summary.total}\nKept: ${summary.kept}\nMigrated: ${summary.migrated}\nRemoved: ${summary.removed}`)
    } catch (e) {
      console.error('Repair failed:', e)
      alert('Repair failed: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!store.isPremium()) {
      alert('Export Vault Backup is a Premium feature. Upgrade to Premium to backup your vault.')
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    try {
      setLoading(true)
      const data = storageManager.exportVault()
      const api = (window as any).electronAPI
      if (api && api.saveVaultFile) {
        const result = await api.saveVaultFile(data)
        if (result.success) {
          alert('Vault backup exported successfully!')
        } else {
          alert('Export canceled or failed: ' + (result.error || ''))
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
        alert('Vault backup downloaded!')
      }
    } catch (e) {
      alert('Export failed: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!store.isPremium()) {
      alert('Import Vault Backup is a Premium feature. Upgrade to Premium to restore backups.')
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }
    if (!confirm('Importing will replace your current vault. Make sure you have a backup! Continue?')) return
    try {
      setLoading(true)
      const api = (window as any).electronAPI
      let data: string
      if (api && api.openVaultFile) {
        const result = await api.openVaultFile()
        if (!result.success) {
          alert('Import canceled or failed: ' + (result.error || ''))
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
            storageManager.importVault(text)
            await loadEntries()
            alert('Vault imported successfully!')
          } catch (err) {
            alert('Import failed: ' + (err as Error).message)
          } finally {
            setLoading(false)
          }
        }
        input.click()
        return
      }
      storageManager.importVault(data)
      await loadEntries()
      alert('Vault imported successfully!')
    } catch (e) {
      alert('Import failed: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (entries.length === 0) {
      alert('No passwords to export')
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
      alert('Name and password are required')
      return
    }

    if (!isEditing && !store.isPremium() && entries.length >= 4) {
      // Free limit reached (only for new entries)
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
        alert('Password updated successfully!')
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
        alert('Password saved successfully!')
      }

      // Reset form and reload entries
      setNewEntry({ name: '', username: '', password: '', url: '', notes: '' })
      setShowAddForm(false)
      setIsEditing(false)
      setEditingEntry(null)
      await loadEntries()
    } catch (error) {
      console.error('Failed to save entry:', error)
      alert('Failed to save password: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      const ok = await copyText(text)
      alert(ok ? 'Copied to clipboard!' : 'Failed to copy')
    } catch (err) {
      console.error('Copy failed:', err)
      alert('Failed to copy')
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

  const handleSetupPasskey = async () => {
    try {
      setLoading(true)

      // Check if WebAuthn is supported
      if (!navigator.credentials || !navigator.credentials.create) {
        alert('Passkey is not supported on this device or browser')
        return
      }

      // Check if we're in a secure context
      if (!window.isSecureContext) {
        alert('Passkey requires a secure context. This feature is not available in this mode.')
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
        alert('Passkey registration cancelled')
        return
      }

      if (credential.type !== 'public-key') {
        alert('Invalid credential type received')
        return
      }

      // Convert credential ID to hex string
      const credentialId = Array.from(new Uint8Array(credential.id as any as ArrayBuffer))
        .map(b => ('0' + b.toString(16)).slice(-2))
        .join('')

      store.setPasskeyCredential(credentialId, 'passkey-registered')
      alert('Passkey setup successful! You can now unlock with your biometric.')
    } catch (e) {
      const errorMsg = (e as Error).message
      if (errorMsg.includes('cancel') || errorMsg.includes('dismissed')) {
        alert('Passkey setup cancelled')
      } else {
        alert('Passkey setup failed: ' + errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="password-vault">
      <div className="vault-header">
        <div className="header-left">
          <h2>Password Vault {store.isPremium() && <span className="premium-badge">Premium</span>}</h2>
        </div>
        <div className="vault-actions">
          <button onClick={onGenerateNew} className="btn-primary">
            Generate
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
            {showAddForm ? 'Cancel' : 'Add New'}
          </button>
          <div className="dropdown">
            <button className="btn-secondary dropdown-toggle" onClick={(e) => {
              const menu = e.currentTarget.nextElementSibling as HTMLElement
              menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
            }}>
              Actions
            </button>
            <div className="dropdown-menu">
              <button onClick={loadEntries} disabled={loading}>Refresh</button>
              {((import.meta as any)?.env?.DEV as boolean) === true && (
                <button onClick={repairVault} disabled={loading}>Repair Vault</button>
              )}
              <button onClick={() => window.dispatchEvent(new Event('open-storage-setup'))}>Change Storage</button>
              {((import.meta as any)?.env?.DEV === true) && (
                <button onClick={handleSetupPasskey} disabled={loading}>Setup Passkey</button>
              )}
              {store.isPremium() && (
                <>
                  <button onClick={handleExport} disabled={loading}>Export Vault Backup</button>
                  <button onClick={handleImport} disabled={loading}>Import Vault Backup</button>
                  <button onClick={exportToCSV}>Export to CSV</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search passwords..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {showAddForm && (
        <div className="add-form">
          <h3>{isEditing ? 'Edit Password' : 'Add New Password'}</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={newEntry.name}
                onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                placeholder="e.g., Gmail, Facebook"
              />
            </div>
            <div className="form-group">
              <label>Username/Email</label>
              <input
                type="text"
                value={newEntry.username}
                onChange={(e) => setNewEntry({ ...newEntry, username: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <div className="password-input-group">
                <input
                  type="text"
                  value={newEntry.password}
                  onChange={(e) => setNewEntry({ ...newEntry, password: e.target.value })}
                  placeholder="Enter or generate password"
                />
                <button onClick={onGenerateNew} className="generate-inline-btn">
                  Generate
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>URL</label>
              <input
                type="text"
                value={newEntry.url}
                onChange={(e) => setNewEntry({ ...newEntry, url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
            <div className="form-group full-width">
              <label>Notes</label>
              <textarea
                value={newEntry.notes}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <button onClick={handleSaveEntry} className="save-btn" disabled={loading}>
            {loading ? 'Saving...' : (isEditing ? 'Update Password' : 'Save Password')}
          </button>
        </div>
      )}

      <div className="entries-list">
        {loading && <div className="loading">Loading...</div>}
        
        {!loading && filteredEntries.length === 0 && (
          <div className="empty-state">
            <p>No passwords stored yet.</p>
            <p>Click "Add Password" to get started!</p>
          </div>
        )}

        {!loading && filteredEntries.map(entry => (
          <div key={entry.id} className="password-entry">
            <div className="entry-header">
              <div className="entry-title">
                <h3>{entry.name}</h3>
                {entry.url && (
                  <a href={entry.url} target="_blank" rel="noopener noreferrer" className="entry-url" title={entry.url}>
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
              <button onClick={() => handleEditEntry(entry)} className="btn-icon" title="Edit">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                </svg>
              </button>
            </div>

            <div className="entry-fields">
              {entry.username && (
                <div className="field-row">
                  <div className="field-content">
                    <span className="field-label">Username</span>
                    <span className="field-text">{entry.username}</span>
                  </div>
                  <button onClick={() => copyToClipboard(entry.username!)} className="btn-copy" title="Copy username">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                    </svg>
                  </button>
                </div>
              )}

              <div className="field-row">
                <div className="field-content">
                  <span className="field-label">Password</span>
                  <span className="field-text password-hidden">••••••••</span>
                </div>
                <button onClick={() => copyToClipboard(entry.password)} className="btn-copy" title="Copy password">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                  </svg>
                </button>
              </div>

              {entry.notes && (
                <div className="field-row notes-row">
                  <div className="field-content">
                    <span className="field-label">Notes</span>
                    <span className="field-text notes-text">{entry.notes}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="entry-footer">
              <span className="entry-date">Added {new Date(entry.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="vault-footer">
        <div className="footer-row">
          <span className="footer-label">Storage Provider</span>
          <span className="footer-value">{storageManager.getCurrentProvider()}</span>
        </div>
        {sessionToken && (
          <div className="footer-row session-token-row">
            <span className="footer-label">Extension Token</span>
            <div className="token-container">
              <input type="text" readOnly value={sessionToken} className="token-input" />
              <button className="btn-copy-small" onClick={async ()=>{ const ok = await copyText(sessionToken); if (!ok) alert('Failed to copy token'); }} title="Copy session token">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                </svg>
              </button>
            </div>
          </div>
        )}
        <div className="footer-encryption">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{marginRight: '6px'}}>
            <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
          </svg>
          All passwords are encrypted with your master password
        </div>
      </div>
    </div>
  )
}

export default PasswordVault
