import { useState } from 'react'
import './Onboarding.css'
import AppFooter from './AppFooter'

interface OnboardingProps {
  onComplete: () => void
}

function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)

  const nextStep = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      onComplete()
    }
  }

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-container">
        <img src="/logo.png" alt="PassGen Logo" className="onboarding-logo" />
        <div className="progress-bar">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`progress-line ${step >= 2 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`progress-line ${step >= 3 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        {step === 1 && (
          <div className="onboarding-step">
            <h1><span className="step-icon">👋</span> Welcome to PassGen!</h1>
            <p className="step-description">
              Your secure password manager and generator
            </p>
            <div className="feature-list">
              <div className="feature-item">
                <span className="feature-icon">🔐</span>
                <div>
                  <strong>Generate Strong Passwords</strong>
                  <p>Create secure, random passwords with customizable options</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">☁️</span>
                <div>
                  <strong>Cloud Sync</strong>
                  <p>Store passwords in Google Drive, AWS S3, or DigitalOcean Spaces</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <div>
                  <strong>Military-Grade Encryption</strong>
                  <p>All passwords encrypted with AES-256 before storage</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🚫</span>
                <div>
                  <strong>Zero-Knowledge</strong>
                  <p>Only you can decrypt your passwords. We never see them.</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔍</span>
                <div>
                  <strong>Search & Organize</strong>
                  <p>Quickly find passwords by name, username, or URL</p>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📋</span>
                <div>
                  <strong>Own Your Storage</strong>
                  <p>Store your passwords on your own storage. Never shared anywhere else.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <h1><span className="step-icon">🛡️</span> How It Works</h1>
            <p className="step-description">
              Your privacy and security, explained
            </p>
            <div className="info-cards">
              <div className="info-card">
                <h3>1️⃣ Choose Storage</h3>
                <p>
                  Select where to store your encrypted passwords:
                  <br />• <strong>Local</strong> - Only on your device
                  <br />• <strong>Google Drive</strong> - Sync across devices
                  <br />• <strong>AWS S3</strong> - Amazon cloud storage
                  <br />• <strong>DigitalOcean</strong> - S3-compatible storage
                </p>
              </div>
              <div className="info-card">
                <h3>2️⃣ Set Master Password</h3>
                <p>
                  Create a strong master password that encrypts all your data.
                  <br /><br />
                  <strong>⚠️ Important:</strong> This password cannot be recovered!
                  Make it memorable and keep it safe.
                </p>
              </div>
              <div className="info-card">
                <h3>3️⃣ Start Using</h3>
                <p>
                  Generate passwords, save them securely, and access them anytime.
                  <br /><br />
                  Everything is encrypted on your device before going to the cloud.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <h1><span className="step-icon">⚡</span> Quick Setup Tips</h1>
            <p className="step-description">
              Get the most out of PassGen
            </p>
            <div className="tips-list">
              <div className="tip-item">
                <span className="tip-number">💡</span>
                <div>
                  <strong>Master Password Best Practices</strong>
                  <ul>
                    <li>Use at least 12-16 characters</li>
                    <li>Mix uppercase, lowercase, numbers, and symbols</li>
                    <li>Make it memorable but unique</li>
                    <li>Consider using a passphrase (e.g., "Coffee&Music@Dawn2025!")</li>
                  </ul>
                </div>
              </div>
              <div className="tip-item">
                <span className="tip-number">🔑</span>
                <div>
                  <strong>Cloud Storage Credentials</strong>
                  <ul>
                    <li>For Google Drive: Get OAuth credentials from Google Cloud Console</li>
                    <li>For AWS S3: Create IAM user with S3 permissions</li>
                    <li>For DigitalOcean: Generate Spaces access keys</li>
                    <li>Or start with Local storage and add cloud sync later</li>
                  </ul>
                </div>
              </div>
              <div className="tip-item">
                <span className="tip-number">🎯</span>
                <div>
                  <strong>Getting Started</strong>
                  <ul>
                    <li>Start simple with local storage if you're unsure</li>
                    <li>You can always change storage providers later</li>
                    <li>Your master password stays the same across providers</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="onboarding-actions">
          {step > 1 && (
            <button onClick={prevStep} className="btn-secondary">
              ← Back
            </button>
          )}
          <button onClick={nextStep} className="btn-primary">
            {step === 3 ? "Let's Get Started! 🚀" : 'Next →'}
          </button>
        </div>

        <div className="step-indicator">
          Step {step} of 3
        </div>
      </div>
      <AppFooter />
    </div>
  )
}

export default Onboarding
