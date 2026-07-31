-- Feelm lead-fordelingssystem: Brønnøysund org number
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- Norwegian org number, captured when a lead is verified against the
-- Brønnøysund entity registry (data.brreg.no) at import.
alter table public.leads
  add column if not exists org_number text;
