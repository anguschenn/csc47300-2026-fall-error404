import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import './AuthModal.css'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error: signUpError, user } = await signUpWithPassword(
          email,
          password,
          displayName.trim() || undefined,
          fullName.trim() || undefined
        )
        if (signUpError) {
          setError(signUpError.message)
        } else {
          // Check if email confirmation is required by Supabase
          if (user && !user.confirmed_at && (!user.identities || user.identities.length === 0)) {
            setSuccessMessage('Registration successful! Please check your email to verify your account.')
          } else {
            setSuccessMessage('Account created successfully!')
            setTimeout(() => {
              onClose()
            }, 1200)
          }
        }
      } else {
        const { error: signInError } = await signInWithPassword(email, password)
        if (signInError) {
          setError(signInError.message)
        } else {
          onClose()
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    const { error: oauthError } = await signInWithGoogle()
    if (oauthError) {
      setError(oauthError.message)
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="auth-modal-close" onClick={onClose} aria-label="Close dialog">
          ✕
        </button>

        <h2 className="auth-modal-title">
          {isSignUp ? 'Create your MetroPulse account' : 'Welcome back'}
        </h2>
        <p className="auth-modal-subtitle">
          {isSignUp
            ? 'Sign up to personalize station alerts and save your commutes.'
            : 'Sign in to access your saved routes and commuter profile.'}
        </p>

        {error && <div className="auth-banner error">{error}</div>}
        {successMessage && <div className="auth-banner success">{successMessage}</div>}

        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <>
              <div className="form-group">
                <label htmlFor="auth-displayname">Display Name (Nickname / Handle)</label>
                <input
                  id="auth-displayname"
                  type="text"
                  placeholder="e.g. Alex or SubwayRider99"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-fullname">Full Name (optional)</label>
                <input
                  id="auth-fullname"
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          <button type="submit" className="submit-auth-btn" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-switch">
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                className="switch-link"
                onClick={() => {
                  setIsSignUp(false)
                  setError(null)
                  setSuccessMessage(null)
                }}
              >
                Sign in
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                className="switch-link"
                onClick={() => {
                  setIsSignUp(true)
                  setError(null)
                  setSuccessMessage(null)
                }}
              >
                Create one
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
