import { DEFAULT_BOARD_ID, supabase } from './supabase'

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
const REMOTE_LOCK_ID = import.meta.env.VITE_LOCK_ID || DEFAULT_BOARD_ID || 'default'

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

function normalizePasswordRecord(record) {
  if (!record?.hashB64 || !record?.saltB64) return null
  return {
    saltB64: record.saltB64,
    hashB64: record.hashB64,
    iter: record.iter || PBKDF2_ITER,
  }
}

function readLocalPasswordRecord() {
  try {
    return normalizePasswordRecord(JSON.parse(localStorage.getItem(PASSWORD_KEY) || 'null'))
  } catch {
    return null
  }
}

function writeLocalPasswordRecord(record) {
  const normalized = normalizePasswordRecord(record)
  if (!normalized) return
  localStorage.setItem(PASSWORD_KEY, JSON.stringify(normalized))
}

function toRemoteRecord(record) {
  const normalized = normalizePasswordRecord(record)
  if (!normalized) return null
  return {
    id: REMOTE_LOCK_ID,
    salt_b64: normalized.saltB64,
    hash_b64: normalized.hashB64,
    iter: normalized.iter,
    updated_at: new Date().toISOString(),
  }
}

function fromRemoteRecord(record) {
  if (!record?.hash_b64 || !record?.salt_b64) return null
  return normalizePasswordRecord({
    saltB64: record.salt_b64,
    hashB64: record.hash_b64,
    iter: record.iter,
  })
}

async function fetchRemotePasswordRecord() {
  const { data, error } = await supabase
    .from('app_locks')
    .select('salt_b64, hash_b64, iter')
    .eq('id', REMOTE_LOCK_ID)
    .maybeSingle()
  if (error) throw error
  return fromRemoteRecord(data)
}

async function saveRemotePasswordRecord(record) {
  const remote = toRemoteRecord(record)
  if (!remote) throw new Error('Invalid password record.')
  const { error } = await supabase
    .from('app_locks')
    .upsert(remote, { onConflict: 'id' })
  if (error) throw error
}

export async function syncPasswordState() {
  const local = readLocalPasswordRecord()
  const remote = await fetchRemotePasswordRecord()
  if (remote) {
    writeLocalPasswordRecord(remote)
    return true
  }

  if (local) {
    await saveRemotePasswordRecord(local)
    return true
  }

  return false
}

export function hasPassword() {
  return !!readLocalPasswordRecord()
}

export async function setPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 4) {
    throw new Error('Password must be at least 4 characters.')
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(plain, salt)
  const record = {
    saltB64: bytesToBase64(salt),
    hashB64: bytesToBase64(hash),
    iter:    PBKDF2_ITER,
  }
  writeLocalPasswordRecord(record)
  await saveRemotePasswordRecord(record)
  markUnlocked()
}

export async function verifyPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) return false
  let parsed = await fetchRemotePasswordRecord()
  if (parsed) {
    writeLocalPasswordRecord(parsed)
  }
  if (!parsed) {
    parsed = readLocalPasswordRecord()
  }
  if (!parsed) return false
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
