-- Feelm lead-fordelingssystem: siste samtale på leadet
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- The latest call outcome + time, denormalised onto the lead so "Alle leads"
-- can filter/sort on "who can be called again" without scanning call_logs.
-- Kept up to date by logCallOutcome; backfilled below from call_logs.
alter table public.leads
  add column if not exists last_call_outcome text,
  add column if not exists last_call_at timestamptz;

create index if not exists leads_last_call_idx
  on public.leads (last_call_outcome, last_call_at)
  where last_call_at is not null;

update public.leads l
set last_call_outcome = c.outcome,
    last_call_at = c.created_at
from (
  select distinct on (lead_id) lead_id, outcome, created_at
  from public.call_logs
  where lead_id is not null
  order by lead_id, created_at desc
) c
where c.lead_id = l.id
  and (l.last_call_at is null or l.last_call_at < c.created_at);
