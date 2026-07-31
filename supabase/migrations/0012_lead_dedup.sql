-- Feelm lead-fordelingssystem: cross-source duplicate detection
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- Points a lead at the original it duplicates (same person from another source,
-- matched on email). Duplicates are set to status 'lost' so they leave the
-- active pipeline and no second seller works the same person.
alter table public.leads
  add column if not exists duplicate_of uuid references public.leads (id) on delete set null;

create index if not exists leads_duplicate_of_idx
  on public.leads (duplicate_of) where duplicate_of is not null;
