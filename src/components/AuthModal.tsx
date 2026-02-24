import { useState } from 'react'
import { signInWithGoogle, signInWithApple } from '../services/auth'
import { Capacitor } from '@capacitor/core'
import { useI18n } from '../services/i18n'
import './AuthModal.css'

interface AuthModalProps {
    open: boolean
    onClose: () => void
    onSuccess: (user: any) => void
}

export default function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
    const { t } = useI18n()
    const [loading, setLoading] = useState(false)
    const isTargetingNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

    if (!open) return null

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true)
            const data = await signInWithGoogle()
            if (data && 'user' in data && data.user) {
                onSuccess(data.user)
            }
            onClose()
        } catch (e: any) {
            alert(t('Google Sign-In failed: {{message}}', { message: e.message }))
        } finally {
            setLoading(false)
        }
    }

    const handleAppleSignIn = async () => {
        try {
            setLoading(true)
            const data = await signInWithApple()
            if (data && 'user' in data && data.user) {
                onSuccess(data.user)
            }
            onClose()
        } catch (e: any) {
            alert(t('Apple Sign-In failed: {{message}}', { message: e.message }))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
                <div className="auth-hero">
                    <h2>{t('Sign In or Create Account')}</h2>
                    <p className="modal-sub">{t('Securely sync your premium status across devices.')}</p>
                </div>

                <div className="auth-actions">
                    {isTargetingNativeIOS && (
                        <button className="auth-btn apple-btn" onClick={handleAppleSignIn} disabled={loading}>
                            <svg width="20" height="20" viewBox="0 0 384 512" fill="currentColor">
                                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                            </svg>
                            {t('Sign in with Apple')}
                        </button>
                    )}

                    <button className="auth-btn google-btn" onClick={handleGoogleSignIn} disabled={loading}>
                        <svg width="20" height="20" viewBox="0 0 48 48">
                            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                        </svg>
                        {t('Sign in with Google')}
                    </button>

                    <button className="btn-secondary ghost" onClick={onClose} disabled={loading} style={{ marginTop: '10px' }}>
                        {t('Cancel')}
                    </button>
                </div>

                <div className="auth-footer">
                    {t('By signing in, you agree to our Terms of Service and Privacy Policy.')}
                </div>
            </div>
        </div>
    )
}
