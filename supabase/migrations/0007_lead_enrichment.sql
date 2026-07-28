-- Feelm lead-fordelingssystem: enrichment fields from HubSpot
-- Run via `supabase db push` or paste into the Supabase SQL editor.

alter table public.leads
  add column if not exists website text,
  add column if not exists industry text,
  add column if not exists job_title text;
