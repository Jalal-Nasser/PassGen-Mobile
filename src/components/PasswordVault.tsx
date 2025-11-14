import { useState, useEffect } from 'react'
import { PasswordEntry } from '../services/encryption'
import { StorageManager } from '../services/storageManager'
import './PasswordVault.css'
import { ConfigStore } from '../services/configStore'

interface PasswordVaultProps {
  storageManager: StorageManager
  onGenerateNew: () => void
}

function PasswordVault({ storageManager, onGenerateNew }: PasswordVaultProps) {
  const [entries, setEntries] = useState<PasswordEntry[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEntry, setNewEntry] = useState({
    name: '',
    username: '',
    password: '',
    url: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const store = new ConfigStore()

  useEffect(() => {
    loadEntries()
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

  const handleSaveEntry = async () => {
    if (!newEntry.name || !newEntry.password) {
      alert('Name and password are required')
      return
    }

    if (!store.isPremium() && entries.length >= 4) {
      // Free limit reached
      window.dispatchEvent(new Event('open-upgrade'))
      return
    }

    try {
      setLoading(true)
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
      setEntries([...entries, entry])
      setNewEntry({ name: '', username: '', password: '', url: '', notes: '' })
      setShowAddForm(false)
      alert('Password saved successfully!')
    } catch (error) {
      console.error('Failed to save entry:', error)
      alert('Failed to save password: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  const filteredEntries = entries.filter(entry =>
    entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.url?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="password-vault">
      <div className="vault-header">
        <h2>🔐 Password Vault</h2>
        <div className="vault-actions">
          <button onClick={onGenerateNew} className="action-btn">
            Generate New
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="action-btn">
            {showAddForm ? 'Cancel' : '+ Add Password'}
          </button>
          <button onClick={loadEntries} className="action-btn" disabled={loading}>
            🔄 Refresh
          </button>
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
          <h3>Add New Password</h3>
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
            {loading ? 'Saving...' : 'Save Password'}
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
        <p className="encryption-notice">
          🔒 All passwords are encrypted with your master password
        </p>
      </div>
    </div>
  )
}

export default PasswordVault
