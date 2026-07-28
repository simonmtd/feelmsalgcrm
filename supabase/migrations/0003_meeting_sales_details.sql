-- Feelm lead-fordelingssystem: sales details on booked meetings
-- Lets sellers register what a meeting is meant to sell and its expected value.
-- Run via `supabase db push` or paste into the Supabase SQL editor.

alter table public.meetings
  add column if not exists deal_size numeric,
  add column if not exists product_type text
    check (product_type in (
      'campaign_film',
      'production_retainer',
      'social_media',
      'corporate_film',
      'event_film',
      'other'
    ));

create index if not exists meetings_lead_id_idx on public.meetings (lead_id);
