-- Feelm lead-fordelingssystem: public lead API (POST/GET /api/leads) for bots
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- 1) New lead source for leads pushed in by a seller's Grok bot.
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads
  add constraint leads_source_check
  check (source in ('apollo', 'hubspot', 'manual', 'apollo-grok'));

-- 2) Extra prospect fields the bot sends that we had no columns for.
alter table public.leads
  add column if not exists linkedin_url text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists employee_count integer,
  add column if not exists email_status text;

-- 3) Short, stable seller handle used by the API's `assigned_to`
--    ("simon", "eskil", "ado", ...). Adding a seller = setting their handle:
--      update public.profiles set handle = 'kari' where email = 'kari@feelm.no';
alter table public.profiles
  add column if not exists handle text;
create unique index if not exists profiles_handle_key
  on public.profiles (lower(handle)) where handle is not null;

-- 4) API keys. Only the SHA-256 hash is stored. A key bound to a seller
--    (seller_id set) can only create leads for that seller and needs no
--    `assigned_to`; a key without seller_id is an admin key.
--    Create one (pgcrypto is enabled in 0001):
--      insert into public.api_keys (name, seller_id, key_hash)
--      values ('grok-simon',
--              (select id from public.profiles where handle = 'simon'),
--              encode(digest('<the-secret-key>', 'sha256'), 'hex'));
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  seller_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Service-role only: RLS on with no policies.
alter table public.api_keys enable row level security;
