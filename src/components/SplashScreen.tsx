import { useEffect, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onComplete: () => void
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Show splash for 3.5 seconds, then fade out over 0.5s
    const timer = setTimeout(() => {
      setFadeOut(true)
    }, 3500)

    const completeTimer = setTimeout(() => {
      onComplete()
    }, 4000)

    return () => {
      clearTimeout(timer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="logo-container">
          <img src="/logo-animated.png" alt="PassGen Logo" className="splash-logo" />
        </div>
        <h1 className="app-title">PassGen</h1>
        <p className="app-tagline">Secure Password Manager</p>
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  )
}
