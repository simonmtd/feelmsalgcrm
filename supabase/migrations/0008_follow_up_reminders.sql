-- Feelm lead-fordelingssystem: follow-up reminder tracking
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- Records when a follow-up reminder was last sent for a lead, so the daily job
-- reminds once per follow-up date instead of every day.
alter table public.leads
  add column if not exists follow_up_reminded_at timestamptz;

create index if not exists leads_follow_up_idx
  on public.leads (next_follow_up_at)
  where next_follow_up_at is not null;
