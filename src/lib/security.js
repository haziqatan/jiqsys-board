// ─── Client-side board lock ─────────────────────────────────────────────
//
// Honest disclaimer: this is a *deterrent*, not a security wall. Anyone with
// browser devtools can inspect localStorage, modify the bundled JS, or just
// delete the unlock check. Real security lives on the server (Supabase Auth +
// RLS). What this module does:
//
//   • Hashes the password with PBKDF2-SHA-256 (random per-user salt,
//     200 000 iterations) and stores only the hash + salt in localStorage.
//   • Tracks an "unlock timestamp" so a single password unlock keeps the app
//     accessible across tabs and reloads for SESSION_HOURS (24 h). After that
//     the next page load prompts again.
//   • Verifies password recovery against a PBKDF2 hash of the owner's
//     recovery email. The literal email string never appears in source or in
//     the compiled bundle — only its salt + hash do, so a hacker reading the
//     code sees opaque base64 instead of the address.
//
// Comparing hashes is done in constant time so a timing attack can't leak
// information about how many bytes matched.
// ────────────────────────────────────────────────────────────────────────

const PASSWORD_KEY = 'jiqsys-pwd'      // { saltB64, hashB64, iter }
const UNLOCK_KEY   = 'jiqsys-unlock'   // unix-ms timestamp string
const SESSION_HOURS = 24
const PBKDF2_ITER   = 200000           // ~50ms on a modern CPU
const HASH_BYTES    = 32

// (Recovery is now handled by a server-side OTP — see /api/send-otp.js
// and /api/verify-otp.js. The recipient emails live exclusively in
// Vercel env vars, never in the source or in the client bundle.)

// ── byte helpers ──
function bytesToBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
function base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]
  return r === 0
}

async function pbkdf2(text, salt, iterations = PBKDF2_ITER, byteLength = HASH_BYTES) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(text), 'PBKDF2', false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    byteLength * 8,
  )
  return new Uint8Array(bits)
}

// ── public api ──

export function hasPassword() {
  try {
    const raw = localStorage.getItem(PASSWORD_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return !!(parsed?.hashB64 && parsed?.saltB64)
  } catch {
    return false
  }
}

export async function setPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 4) {
    throw new Error('Password must be at least 4 characters.')
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(plain, salt)
  localStorage.setItem(PASSWORD_KEY, JSON.stringify({
    saltB64: bytesToBase64(salt),
    hashB64: bytesToBase64(hash),
    iter:    PBKDF2_ITER,
  }))
  markUnlocked()
}

export async function verifyPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) return false
  const raw = localStorage.getItem(PASSWORD_KEY)
  if (!raw) return false
  let parsed
  try { parsed = JSON.parse(raw) } catch { return false }
  if (!parsed?.hashB64 || !parsed?.saltB64) return false
  const expected = base64ToBytes(parsed.hashB64)
  const computed = await pbkdf2(
    plain,
    base64ToBytes(parsed.saltB64),
    parsed.iter || PBKDF2_ITER,
    expected.length,
  )
  return constantTimeEqual(computed, expected)
}

export function markUnlocked() {
  localStorage.setItem(UNLOCK_KEY, String(Date.now()))
}

export function lock() {
  localStorage.removeItem(UNLOCK_KEY)
}

export function isUnlocked() {
  if (!hasPassword()) return false
  const ts = parseInt(localStorage.getItem(UNLOCK_KEY) || '0', 10)
  if (!ts) return false
  const ageMs = Date.now() - ts
  if (ageMs < 0) return false // clock-skew safety
  return ageMs < SESSION_HOURS * 60 * 60 * 1000
}

export function unlockExpiresAt() {
  const ts = parseInt(localStorage.getItem(UNLOCK_KEY) || '0', 10)
  if (!ts) return null
  return ts + SESSION_HOURS * 60 * 60 * 1000
}
