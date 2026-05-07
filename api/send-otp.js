// ─── Vercel serverless: generate + email a 6-digit password-reset OTP ───
//
// Why a serverless function (not client code):
//   • The recipient email addresses live ONLY in Vercel env vars
//     (`OTP_RECIPIENTS`), so they never touch the source or the bundle
//     shipped to browsers.
//   • Sending email requires a provider API key (`RESEND_API_KEY`) which
//     must stay server-side.
//   • Writing OTP hashes to Supabase requires the SERVICE_ROLE key, which
//     also must stay server-side.
//
// Required Vercel environment variables:
//   OTP_RECIPIENTS              — comma-separated emails to receive the OTP
//                                 (e.g. "a@b.com,c@d.com"). Hidden here.
//   RESEND_API_KEY              — from https://resend.com (free tier OK)
//   RESEND_FROM                 — verified sender, e.g. "Board <onboarding@resend.dev>"
//   SUPABASE_URL                — same value as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   — Supabase project → Settings → API → service_role
//
// Database: requires the `otp_codes` table from
//   supabase/migrations/20260508000000_otp_codes.sql

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const OTP_TTL_MINUTES = 10
const RATE_WINDOW_MS  = 60_000   // disallow >1 request per minute (per server)

let lastSentAt = 0

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  // Tiny rate limiter — keeps a misbehaving client from flooding inboxes.
  // (Stateless across Vercel cold starts; that's intentional, just a soft cap.)
  if (Date.now() - lastSentAt < RATE_WINDOW_MS) {
    res.status(429).json({ ok: false, error: 'Please wait a minute before requesting another OTP.' })
    return
  }

  const recipientsRaw = process.env.OTP_RECIPIENTS
  const resendKey     = process.env.RESEND_API_KEY
  const resendFrom    = process.env.RESEND_FROM
  const supabaseUrl   = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!recipientsRaw || !resendKey || !resendFrom || !supabaseUrl || !serviceKey) {
    // Don't leak which one is missing — generic error to the client.
    console.error('OTP env vars not fully configured.')
    res.status(500).json({ ok: false, error: 'Server is not configured to send OTPs.' })
    return
  }

  const recipients = recipientsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  if (recipients.length === 0) {
    res.status(500).json({ ok: false, error: 'No OTP recipients configured.' })
    return
  }

  // Cryptographically random 6-digit code (000000–999999, leading zeros kept)
  const otp  = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const hash = crypto.createHash('sha256').update(otp).digest('hex')
  const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString()

  // Persist hash so /api/verify-otp can verify it
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Invalidate any prior unused OTPs first (one active code at a time)
  await supabase.from('otp_codes').update({ used: true }).eq('used', false)

  const { error: dbError } = await supabase
    .from('otp_codes')
    .insert({ hash, expires_at })
  if (dbError) {
    console.error('OTP insert failed:', dbError)
    res.status(500).json({ ok: false, error: 'Could not store OTP.' })
    return
  }

  // Send via Resend. The SAME OTP goes to all recipients in one mail.
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to:   recipients,
        subject: 'Your board password-reset code',
        text: [
          'Someone requested to reset the password on your board.',
          '',
          `Your 6-digit code is: ${otp}`,
          '',
          `This code is valid for ${OTP_TTL_MINUTES} minutes. If you didn't ask for this, you can ignore this message.`,
        ].join('\n'),
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2330; line-height: 1.5;">
            <p>Someone requested to reset the password on your board.</p>
            <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 14px 0; color: #2563eb;">
              ${otp}
            </p>
            <p style="color: #525a6b; font-size: 13px;">
              This code is valid for ${OTP_TTL_MINUTES} minutes.
              If you didn't ask for this, you can safely ignore this email.
            </p>
          </div>
        `.trim(),
      }),
    })
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      console.error('Resend send failed:', r.status, detail)
      res.status(502).json({ ok: false, error: 'Email provider rejected the request.' })
      return
    }
  } catch (err) {
    console.error('Resend send threw:', err)
    res.status(502).json({ ok: false, error: 'Could not contact the email provider.' })
    return
  }

  lastSentAt = Date.now()
  res.status(200).json({ ok: true })
}
