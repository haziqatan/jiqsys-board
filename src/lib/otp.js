// Thin client-side helper around the /api/send-otp and /api/verify-otp
// Vercel serverless endpoints. Both round-trips return `{ ok, error? }`.

export async function requestResetOtp() {
  try {
    const r = await fetch('/api/send-otp', { method: 'POST' })
    const json = await r.json().catch(() => ({}))
    if (!r.ok || !json.ok) {
      return { ok: false, error: json.error || `Server error (${r.status})` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: 'Could not reach the OTP service.' }
  }
}

export async function verifyResetOtp(code) {
  try {
    const r = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const json = await r.json().catch(() => ({}))
    if (!r.ok || !json.ok) {
      return { ok: false, error: json.error || `Server error (${r.status})` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: 'Could not reach the OTP service.' }
  }
}
