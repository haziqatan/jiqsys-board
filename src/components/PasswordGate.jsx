import { useEffect, useRef, useState } from 'react'
import {
  hasPassword,
  isUnlocked,
  setPassword,
  verifyPassword,
  verifyRecoveryEmail,
  markUnlocked,
  lock,
} from '../lib/security'
import '../styles/PasswordGate.css'

// Stages:
//  • 'setup'         – first-time visit, no password yet
//  • 'login'         – locked, ask for password
//  • 'recover-email' – user clicked "Forgot password?"
//  • 'recover-set'   – email verified, choose a new password
const initialStage = () => (hasPassword() ? 'login' : 'setup')

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => isUnlocked())
  const [stage, setStage] = useState(initialStage)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  // Auto-focus the first relevant input when the stage changes.
  useEffect(() => {
    if (unlocked) return
    const id = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(id)
  }, [stage, unlocked])

  // Re-check the unlock timestamp every minute. If 24 h passed while the tab
  // sat idle, kick the user back to the lock screen on the next minute tick.
  useEffect(() => {
    if (!unlocked) return
    const id = setInterval(() => {
      if (!isUnlocked()) {
        setUnlocked(false)
        setStage('login')
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [unlocked])

  // Keep this tab in sync if another tab locks/unlocks via storage events.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'jiqsys-unlock' || e.key === 'jiqsys-pwd') {
        const u = isUnlocked()
        setUnlocked(u)
        if (!u) setStage(hasPassword() ? 'login' : 'setup')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const resetForm = () => { setPwd(''); setPwd2(''); setEmail(''); setError('') }

  const handleSetup = async (e) => {
    e.preventDefault()
    setError('')
    if (pwd.length < 4) return setError('Password must be at least 4 characters.')
    if (pwd !== pwd2) return setError('Passwords do not match.')
    setBusy(true)
    try {
      await setPassword(pwd)
      resetForm()
      setUnlocked(true)
    } catch (err) {
      setError(err.message || 'Could not set password.')
    } finally {
      setBusy(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const ok = await verifyPassword(pwd)
      if (!ok) {
        setError('Incorrect password.')
        setPwd('')
        return
      }
      markUnlocked()
      resetForm()
      setUnlocked(true)
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyEmail = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const ok = await verifyRecoveryEmail(email)
      if (!ok) {
        setError('That email does not match the recovery address on file.')
        return
      }
      setEmail('')
      setStage('recover-set')
    } finally {
      setBusy(false)
    }
  }

  const handleRecoverSet = async (e) => {
    e.preventDefault()
    setError('')
    if (pwd.length < 4) return setError('Password must be at least 4 characters.')
    if (pwd !== pwd2) return setError('Passwords do not match.')
    setBusy(true)
    try {
      await setPassword(pwd)
      resetForm()
      setUnlocked(true)
    } catch (err) {
      setError(err.message || 'Could not save the new password.')
    } finally {
      setBusy(false)
    }
  }

  if (unlocked) {
    return (
      <>
        {children}
        <button
          className="pg-lock-btn"
          title="Lock board now"
          onClick={() => {
            lock()
            setUnlocked(false)
            setStage('login')
          }}
        >
          <LockIcon />
        </button>
      </>
    )
  }

  const card = (() => {
    switch (stage) {
      case 'setup':
        return (
          <form className="pg-card" onSubmit={handleSetup} autoComplete="off">
            <div className="pg-icon-wrap"><LockIcon size={22} /></div>
            <h1 className="pg-title">Set up your board</h1>
            <p className="pg-sub">Choose a password to protect this board. You'll be asked for it again every 24 hours.</p>
            <input
              ref={inputRef}
              className="pg-input"
              type="password"
              placeholder="New password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
            <input
              className="pg-input"
              type="password"
              placeholder="Confirm password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
            {error && <div className="pg-error">{error}</div>}
            <button className="pg-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
            <p className="pg-foot">A recovery address is already configured for this board. You'll be asked for it if you ever forget the password.</p>
          </form>
        )

      case 'login':
        return (
          <form className="pg-card" onSubmit={handleLogin} autoComplete="off">
            <div className="pg-icon-wrap"><LockIcon size={22} /></div>
            <h1 className="pg-title">Locked</h1>
            <p className="pg-sub">Enter your password to continue.</p>
            <input
              ref={inputRef}
              className="pg-input"
              type="password"
              placeholder="Password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="current-password"
              required
            />
            {error && <div className="pg-error">{error}</div>}
            <button className="pg-primary" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Unlock'}
            </button>
            <button
              type="button"
              className="pg-link"
              onClick={() => { resetForm(); setStage('recover-email') }}
            >
              Forgot password?
            </button>
          </form>
        )

      case 'recover-email':
        return (
          <form className="pg-card" onSubmit={handleVerifyEmail} autoComplete="off">
            <div className="pg-icon-wrap"><KeyIcon size={22} /></div>
            <h1 className="pg-title">Reset password</h1>
            <p className="pg-sub">Enter the recovery email associated with this board to confirm it's you.</p>
            <input
              ref={inputRef}
              className="pg-input"
              type="email"
              placeholder="Recovery email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {error && <div className="pg-error">{error}</div>}
            <button className="pg-primary" type="submit" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="pg-link"
              onClick={() => { resetForm(); setStage('login') }}
            >
              Back to sign in
            </button>
          </form>
        )

      case 'recover-set':
        return (
          <form className="pg-card" onSubmit={handleRecoverSet} autoComplete="off">
            <div className="pg-icon-wrap"><KeyIcon size={22} /></div>
            <h1 className="pg-title">Choose a new password</h1>
            <p className="pg-sub">Recovery confirmed. Set a new password.</p>
            <input
              ref={inputRef}
              className="pg-input"
              type="password"
              placeholder="New password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
            <input
              className="pg-input"
              type="password"
              placeholder="Confirm password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
            {error && <div className="pg-error">{error}</div>}
            <button className="pg-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )
      default:
        return null
    }
  })()

  return (
    <div className="pg-overlay">
      <div className="pg-bg" />
      {card}
    </div>
  )
}

function LockIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2.4" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  )
}

function KeyIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="14" r="4" />
      <path d="M12.5 11.5L20 4M17 7l3 3M15 9l3 3" />
    </svg>
  )
}
