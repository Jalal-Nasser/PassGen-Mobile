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

  return (
    <div className="password-vault">
      <div className="vault-header">
        <h2>🔐 Password Vault {store.isPremium() && <span className="premium-badge">⭐ Premium</span>}</h2>
        <div className="vault-actions">
          <button onClick={onGenerateNew} className="action-btn">
            Generate New
          </button>
          <button onClick={() => {
            setShowAddForm(!showAddForm)
            if (showAddForm) {
              // Canceling
              setIsEditing(false)
              setEditingEntry(null)
              setNewEntry({ name: '', username: '', password: '', url: '', notes: '' })
            }
          }} className="action-btn">
            {showAddForm ? 'Cancel' : '+ Add Password'}
          </button>
          <button onClick={loadEntries} className="action-btn" disabled={loading}>
            🔄 Refresh
          </button>
          {((import.meta as any)?.env?.DEV as boolean) === true && (
            <button onClick={repairVault} className="action-btn" disabled={loading}>
              🛠 Repair
            </button>
          )}
          <button onClick={() => window.dispatchEvent(new Event('open-storage-setup'))} className="action-btn">
            ⚙️ Change Storage
          </button>
          {store.isPremium() && (
            <button onClick={exportToCSV} className="action-btn">
              📄 Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Search passwords..."
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
              <h3>{entry.name}</h3>
              <div className="entry-meta">
                {entry.url && (
                  <a href={entry.url} target="_blank" rel="noopener noreferrer" className="entry-url">
                    🔗 Open
                  </a>
                )}
                <button onClick={() => handleEditEntry(entry)} className="edit-btn">
                  ✏️ Edit
                </button>
              </div>
            </div>
            
            {entry.username && (
              <div className="entry-field">
                <label>Username:</label>
                <div className="field-value">
                  <span>{entry.username}</span>
                  <button onClick={() => copyToClipboard(entry.username!)} className="copy-small-btn">
                    📋
                  </button>
                </div>
              </div>
            )}
            
            <div className="entry-field">
              <label>Password:</label>
              <div className="field-value">
                <span className="password-hidden">••••••••</span>
                <button onClick={() => copyToClipboard(entry.password)} className="copy-small-btn">
                  📋 Copy
                </button>
              </div>
            </div>
            
            {entry.notes && (
              <div className="entry-field">
                <label>Notes:</label>
                <p className="notes">{entry.notes}</p>
              </div>
            )}
            
            <div className="entry-footer">
              <small>Created: {new Date(entry.createdAt).toLocaleDateString()}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="vault-footer">
        <p>
          Storage: <strong>{storageManager.getCurrentProvider()}</strong>
        </p>
        <p className="encryption-notice" style={{display:'flex', alignItems:'center', gap:8}}>
          🔑 Session Token: <input type="text" readOnly value={sessionToken} style={{flex:1}} />
          <button className="copy-small-btn" onClick={async ()=>{ const ok = await copyText(sessionToken); if (!ok) alert('Failed to copy token'); }}>Copy</button>
        </p>
        <p className="encryption-notice">
          🔒 All passwords are encrypted with your master password
        </p>
      </div>
    </div>
  )
}

export default PasswordVault
