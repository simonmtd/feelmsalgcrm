-- Feelm lead-fordelingssystem: Apollo enrichment tracking
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- apollo_person_id lets the async phone-reveal webhook match Apollo's callback
-- back to the right lead. enriched_at records when we last ran enrichment so we
-- can avoid re-spending credits on a lead we already enriched.
alter table public.leads
  add column if not exists apollo_person_id text,
  add column if not exists enriched_at timestamptz;

create index if not exists leads_apollo_person_idx
  on public.leads (apollo_person_id)
  where apollo_person_id is not null;
