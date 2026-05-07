// ─── Vercel serverless: verify a submitted 6-digit OTP ───────────────
//
// Hashes the user-submitted code, looks for an unexpired, unused match
// in `otp_codes`, marks it used, and returns ok:true.
//
// The hash never leaves the server and the table is RLS-locked, so the
// client cannot brute-force the code offline against the public anon
// key. (A 6-digit OTP only has 1M possibilities — fast to crack offline,
// safe with server-only access.)

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  const code = String(body?.code || '').trim()
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ ok: false, error: 'Code must be 6 digits.' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('OTP verify env vars not configured.')
    res.status(500).json({ ok: false, error: 'Server is not configured.' })
    return
  }

  const hash = crypto.createHash('sha256').update(code).digest('hex')
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await supabase
    .from('otp_codes')
    .select('id, expires_at, used')
    .eq('hash', hash)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('OTP lookup failed:', error)
    res.status(500).json({ ok: false, error: 'Could not verify the code.' })
    return
  }
  if (!data) {
    res.status(401).json({ ok: false, error: 'That code is invalid or has expired.' })
    return
  }

  // Single-use — mark it consumed so the same code can't be replayed.
  await supabase.from('otp_codes').update({ used: true }).eq('id', data.id)

  res.status(200).json({ ok: true })
}
