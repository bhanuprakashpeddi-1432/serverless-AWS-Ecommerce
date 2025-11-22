import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, confirmSignUp, error: authError } = useAuth()
  
  const [isSignUp, setIsSignUp] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const from = location.state?.from?.pathname || '/'

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      await signUp(email, password, givenName, familyName)
      setNeedsConfirmation(true)
      setMessage('Please check your email for confirmation code')
    } catch (err) {
      setError(err.message || 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      await confirmSignUp(email, confirmationCode)
      setMessage('Account confirmed! Please sign in.')
      setNeedsConfirmation(false)
      setIsSignUp(false)
    } catch (err) {
      setError(err.message || 'Failed to confirm sign up')
    } finally {
      setLoading(false)
    }
  }

  if (needsConfirmation) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2>Confirm Your Account</h2>
          <form onSubmit={handleConfirmSignUp}>
            <div className="form-group">
              <label htmlFor="confirmationCode">Confirmation Code</label>
              <input
                type="text"
                id="confirmationCode"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Confirming...' : 'Confirm'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
        <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
          {isSignUp && (
            <>
              <div className="form-group">
                <label htmlFor="givenName">First Name</label>
                <input
                  type="text"
                  id="givenName"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="familyName">Last Name</label>
                <input
                  type="text"
                  id="familyName"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {(error || authError) && <div className="error-message">{error || authError}</div>}
          {message && <div className="success-message">{message}</div>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (isSignUp ? 'Creating...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>
        <div className="toggle-form">
          <button onClick={() => setIsSignUp(!isSignUp)} className="btn-link">
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
        {!isSignUp && (
          <div className="demo-credentials">
            <p><strong>Demo Admin:</strong> admin@email.com / Admin123!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
