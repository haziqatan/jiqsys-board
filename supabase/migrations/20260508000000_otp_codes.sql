-- ─── OTP storage for password-reset flow ────────────────────────────
-- Run this once in Supabase SQL Editor (or via supabase CLI) to create
-- the table that backs the 6-digit OTP password-reset flow.
--
-- The table stores SHA-256 hashes of OTPs (never the plaintext code) and
-- only the serverless functions in /api (running on Vercel with the
-- service-role key) ever read or write it. Row Level Security is enabled
-- and no policies are added, so the public anon key cannot see, insert,
-- or modify entries — only the elevated service-role key (used in the
-- /api/send-otp and /api/verify-otp functions) can.

create table if not exists public.otp_codes (
  id          uuid        primary key default gen_random_uuid(),
  hash        text        not null,
  expires_at  timestamptz not null,
  used        boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Fast lookup of valid pending codes during verify
create index if not exists otp_codes_pending_idx
  on public.otp_codes (hash)
  where used = false;

-- Lock the table down — only service-role can read/write
alter table public.otp_codes enable row level security;

-- Optional: a periodic cleanup of expired rows. Uncomment to schedule a
-- daily run via pg_cron, or call manually: select prune_expired_otps();
create or replace function public.prune_expired_otps()
returns void
language sql
security definer
as $$
  delete from public.otp_codes
  where expires_at < now() - interval '1 day';
$$;
