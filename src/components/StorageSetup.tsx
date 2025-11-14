import { useState } from 'react'
import { StorageConfig, ConfigStore } from '../services/configStore'
import './StorageSetup.css'

interface StorageSetupProps {
  onConfigured: (config: StorageConfig) => void
}

function StorageSetup({ onConfigured }: StorageSetupProps) {
  const [provider, setProvider] = useState<'local' | 'google-drive' | 's3' | 'digitalocean'>('local')
  const [showInfo, setShowInfo] = useState(true)
  const store = new ConfigStore()
  const isPremium = store.isPremium()
  const [formData, setFormData] = useState({
    // Google Drive
    gdClientId: '',
    gdClientSecret: '',
    // AWS S3
    s3AccessKey: '',
    s3SecretKey: '',
    s3Region: 'us-east-1',
    s3Bucket: '',
    // DigitalOcean
    doAccessKey: '',
    doSecretKey: '',
    doRegion: 'nyc3',
    doBucket: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const config: StorageConfig = {
      provider,
    }

    switch (provider) {
      case 'google-drive':
        config.googleDrive = {
          clientId: formData.gdClientId,
          clientSecret: formData.gdClientSecret,
        }
        break
      
      case 's3':
        config.s3 = {
          accessKeyId: formData.s3AccessKey,
          secretAccessKey: formData.s3SecretKey,
          region: formData.s3Region,
          bucket: formData.s3Bucket,
        }
        break
      
      case 'digitalocean':
        config.digitalocean = {
          accessKeyId: formData.doAccessKey,
          secretAccessKey: formData.doSecretKey,
          region: formData.doRegion,
          bucket: formData.doBucket,
        }
        break
    }

    onConfigured(config)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="storage-setup">
      <h2>🔒 Configure Storage</h2>
      <p className="subtitle">Choose where to store your encrypted passwords</p>

      {showInfo && (
        <div className="info-banner">
          <div className="info-content">
            <strong>📌 New to PassGen?</strong>
            <p>
              Don't have cloud credentials yet? Start with <strong>Local Storage</strong> and 
              add cloud sync later. You can always change providers in settings.
            </p>
          </div>
          <button onClick={() => setShowInfo(false)} className="close-info">×</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="provider-selection">
          <label className="provider-option">
            <input
              type="radio"
              name="provider"
              value="local"
              checked={provider === 'local'}
              onChange={(e) => setProvider(e.target.value as any)}
            />
            <span className="provider-icon">💾</span>
            <div className="provider-info">
              <strong>Local Storage</strong>
              <span>Store passwords locally on your device</span>
            </div>
          </label>

          <label className={`provider-option ${!isPremium ? 'disabled' : ''}`} onClick={() => { if(!isPremium){ window.dispatchEvent(new Event('open-upgrade')) }}}>
            <input
              type="radio"
              name="provider"
              value="google-drive"
              checked={provider === 'google-drive'}
              onChange={(e) => setProvider(e.target.value as any)}
              disabled={!isPremium}
            />
            <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" alt="Google Drive" className="provider-icon" />
            <div className="provider-info">
              <strong>Google Drive {!isPremium && '— Premium'}</strong>
              <span>Store passwords in your Google Drive</span>
            </div>
          </label>

          <label className={`provider-option ${!isPremium ? 'disabled' : ''}`} onClick={() => { if(!isPremium){ window.dispatchEvent(new Event('open-upgrade')) }}}>
            <input
              type="radio"
              name="provider"
              value="s3"
              checked={provider === 's3'}
              onChange={(e) => setProvider(e.target.value as any)}
              disabled={!isPremium}
            />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Amazon-S3-Logo.svg/428px-Amazon-S3-Logo.svg.png" alt="AWS S3" className="provider-icon" />
            <div className="provider-info">
              <strong>AWS S3 {!isPremium && '— Premium'}</strong>
              <span>Store passwords in Amazon S3</span>
            </div>
          </label>

          <label className={`provider-option ${!isPremium ? 'disabled' : ''}`} onClick={() => { if(!isPremium){ window.dispatchEvent(new Event('open-upgrade')) }}}>
            <input
              type="radio"
              name="provider"
              value="digitalocean"
              checked={provider === 'digitalocean'}
              onChange={(e) => setProvider(e.target.value as any)}
              disabled={!isPremium}
            />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/DigitalOcean_logo.svg/768px-DigitalOcean_logo.svg.png" alt="DigitalOcean" className="provider-icon" />
            <div className="provider-info">
              <strong>DigitalOcean Spaces {!isPremium && '— Premium'}</strong>
              <span>Store passwords in DigitalOcean Spaces</span>
            </div>
          </label>
        </div>

        {provider === 'google-drive' && (
          <div className="config-fields">
            <h3>Google Drive Configuration</h3>
            <div className="form-group">
              <label>Client ID</label>
              <input
                type="text"
                value={formData.gdClientId}
                onChange={(e) => handleInputChange('gdClientId', e.target.value)}
                placeholder="Your Google OAuth Client ID"
                required
              />
            </div>
            <div className="form-group">
              <label>Client Secret</label>
              <input
                type="password"
                value={formData.gdClientSecret}
                onChange={(e) => handleInputChange('gdClientSecret', e.target.value)}
                placeholder="Your Google OAuth Client Secret"
                required
              />
            </div>
            <p className="help-text">
              Get your credentials from{' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                Google Cloud Console
              </a>
            </p>
          </div>
        )}

        {provider === 's3' && (
          <div className="config-fields">
            <h3>AWS S3 Configuration</h3>
            <div className="form-group">
              <label>Access Key ID</label>
              <input
                type="text"
                value={formData.s3AccessKey}
                onChange={(e) => handleInputChange('s3AccessKey', e.target.value)}
                placeholder="Your AWS Access Key"
                required
              />
            </div>
            <div className="form-group">
              <label>Secret Access Key</label>
              <input
                type="password"
                value={formData.s3SecretKey}
                onChange={(e) => handleInputChange('s3SecretKey', e.target.value)}
                placeholder="Your AWS Secret Key"
                required
              />
            </div>
            <div className="form-group">
              <label>Region</label>
              <input
                type="text"
                value={formData.s3Region}
                onChange={(e) => handleInputChange('s3Region', e.target.value)}
                placeholder="us-east-1"
                required
              />
            </div>
            <div className="form-group">
              <label>Bucket Name</label>
              <input
                type="text"
                value={formData.s3Bucket}
                onChange={(e) => handleInputChange('s3Bucket', e.target.value)}
                placeholder="my-passwords-bucket"
                required
              />
            </div>
          </div>
        )}

        {provider === 'digitalocean' && (
          <div className="config-fields">
            <h3>DigitalOcean Spaces Configuration</h3>
            <div className="form-group">
              <label>Access Key</label>
              <input
                type="text"
                value={formData.doAccessKey}
                onChange={(e) => handleInputChange('doAccessKey', e.target.value)}
                placeholder="Your Spaces Access Key"
                required
              />
            </div>
            <div className="form-group">
              <label>Secret Key</label>
              <input
                type="password"
                value={formData.doSecretKey}
                onChange={(e) => handleInputChange('doSecretKey', e.target.value)}
                placeholder="Your Spaces Secret Key"
                required
              />
            </div>
            <div className="form-group">
              <label>Region</label>
              <select
                value={formData.doRegion}
                onChange={(e) => handleInputChange('doRegion', e.target.value)}
              >
                <option value="nyc3">New York 3</option>
                <option value="sfo3">San Francisco 3</option>
                <option value="sgp1">Singapore 1</option>
                <option value="fra1">Frankfurt 1</option>
              </select>
            </div>
            <div className="form-group">
              <label>Space Name</label>
              <input
                type="text"
                value={formData.doBucket}
                onChange={(e) => handleInputChange('doBucket', e.target.value)}
                placeholder="my-passwords-space"
                required
              />
            </div>
          </div>
        )}

        <button type="submit" className="submit-btn">
          Continue
        </button>
      </form>
    </div>
  )
}

export default StorageSetup
