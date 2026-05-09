-- Shared app lock for the client-side password gate.
--
-- This lets a browser/device with no localStorage entry discover that the
-- board already has a password and show the Locked screen instead of setup.
-- The app still performs client-side password verification, so this is a
-- convenience/deterrent lock rather than a replacement for Supabase Auth/RLS.

create table if not exists public.app_locks (
  id          text        primary key,
  salt_b64    text        not null,
  hash_b64    text        not null,
  iter        integer     not null default 200000,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.app_locks enable row level security;

create policy "app_locks_select_anon"
  on public.app_locks
  for select
  to anon
  using (true);

create policy "app_locks_insert_anon"
  on public.app_locks
  for insert
  to anon
  with check (true);

create policy "app_locks_update_anon"
  on public.app_locks
  for update
  to anon
  using (true)
  with check (true);
