-- Feelm lead-fordelingssystem: mark a meeting's deal as signed
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- Lets a seller (or admin) mark a booked meeting as signed, feeding the
-- dashboard leaderboard (meetings booked + signed value per seller).
alter table public.meetings
  add column if not exists signed boolean not null default false,
  add column if not exists signed_at timestamptz;
