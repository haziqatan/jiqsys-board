import { useEffect, useRef, useState } from 'react'
import {
  hasPassword,
  isUnlocked,
  syncPasswordState,
  setPassword,
  verifyPassword,
  markUnlocked,
  lock,
} from '../lib/security'
import { requestResetOtp, verifyResetOtp } from '../lib/otp'
import '../styles/PasswordGate.css'

const canSetUpPassword = () =>
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_PASSWORD_SETUP === 'true'

// Stages:
//  • 'checking'     – fresh browser, checking whether a shared lock exists
//  • 'setup'        – first-time/local setup, only when explicitly allowed
//  • 'login'        – locked, ask for password
//  • 'otp-request'  – user clicked "Forgot password?", confirm sending email
//  • 'otp-enter'    – OTP sent, user types the 6-digit code
//  • 'otp-set'      – OTP verified, choose a new password
const initialStage = () => 'checking'

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => isUnlocked())
  const [stage, setStage] = useState(initialStage)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (stage !== 'checking') return
    let cancelled = false
    ;(async () => {
      try {
        const exists = await syncPasswordState()
        if (cancelled) return
        if (!unlocked) setStage(exists || !canSetUpPassword() ? 'login' : 'setup')
      } catch (err) {
        console.warn('Could not check shared board lock:', err)
        if (!cancelled) setStage(hasPassword() || !canSetUpPassword() ? 'login' : 'setup')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stage, unlocked])

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

  useEffect(() => {
    if (!unlocked) return undefined
    const onLockBoard = () => {
      lock()
      setUnlocked(false)
      setStage('login')
    }
    window.addEventListener('jiqsys-lock-board', onLockBoard)
    return () => window.removeEventListener('jiqsys-lock-board', onLockBoard)
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

  const resetForm = () => { setPwd(''); setPwd2(''); setOtp(''); setError(''); setInfo('') }

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
    } catch (err) {
      console.warn('Could not verify board password:', err)
      setError('Could not check the password. Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  // Step 1 of reset: ask the server to email a 6-digit OTP to the
  // recipients configured in Vercel env vars (never present in source).
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const res = await requestResetOtp()
      if (!res.ok) {
        setError(res.error || 'Could not send the code.')
        return
      }
      setInfo('A 6-digit code was sent to the recovery inbox. It expires in 10 minutes.')
      setStage('otp-enter')
    } finally {
      setBusy(false)
    }
  }

  // Step 2: send the typed code back to the server for verification.
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(otp.trim())) return setError('Please enter the 6-digit code.')
    setBusy(true)
    try {
      const res = await verifyResetOtp(otp.trim())
      if (!res.ok) {
        setError(res.error || 'That code is invalid or has expired.')
        return
      }
      setOtp('')
      setInfo('')
      setStage('otp-set')
    } finally {
      setBusy(false)
    }
  }

  // Step 3: write the new password.
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
    return children
  }

  const card = (() => {
    switch (stage) {
      case 'checking':
        return (
          <div className="pg-card">
            <div className="pg-icon-wrap"><LockIcon size={22} /></div>
            <h1 className="pg-title">Checking lock</h1>
            <p className="pg-sub">Looking for this board's saved password.</p>
          </div>
        )

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
              onClick={() => { resetForm(); setStage('otp-request') }}
            >
              Forgot password?
            </button>
          </form>
        )

      case 'otp-request':
        return (
          <form className="pg-card" onSubmit={handleSendOtp} autoComplete="off">
            <div className="pg-icon-wrap"><KeyIcon size={22} /></div>
            <h1 className="pg-title">Reset password</h1>
            <p className="pg-sub">
              We'll email a 6-digit code to the recovery inbox configured for this
              board. The code is valid for 10 minutes.
            </p>
            {error && <div className="pg-error">{error}</div>}
            <button className="pg-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send code'}
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

      case 'otp-enter':
        return (
          <form className="pg-card" onSubmit={handleVerifyOtp} autoComplete="off">
            <div className="pg-icon-wrap"><KeyIcon size={22} /></div>
            <h1 className="pg-title">Enter the code</h1>
            <p className="pg-sub">
              {info || 'Check your recovery inbox for a 6-digit code.'}
            </p>
            <input
              ref={inputRef}
              className="pg-input pg-input-otp"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
              required
            />
            {error && <div className="pg-error">{error}</div>}
            <button className="pg-primary" type="submit" disabled={busy || otp.length !== 6}>
              {busy ? 'Verifying…' : 'Verify code'}
            </button>
            <button
              type="button"
              className="pg-link"
              onClick={async () => {
                setError('')
                setBusy(true)
                const res = await requestResetOtp()
                setBusy(false)
                if (res.ok) setInfo('A new code was sent to the recovery inbox.')
                else setError(res.error || 'Could not resend.')
              }}
              disabled={busy}
            >
              Resend code
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

      case 'otp-set':
        return (
          <form className="pg-card" onSubmit={handleRecoverSet} autoComplete="off">
            <div className="pg-icon-wrap"><KeyIcon size={22} /></div>
            <h1 className="pg-title">Choose a new password</h1>
            <p className="pg-sub">Code verified. Set a new password.</p>
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
