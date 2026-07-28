-- Feelm lead-fordelingssystem: team calendar (sales meetings etc.)
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  title text not null,
  type text not null default 'sales_meeting' check (type in ('sales_meeting', 'demo', 'follow_up', 'internal', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  constraint meetings_ends_after_starts check (ends_at > starts_at)
);

create index if not exists meetings_seller_starts_idx on public.meetings (seller_id, starts_at);

alter table public.meetings enable row level security;

-- meetings: the whole team can see everyone's meetings (team calendar);
-- sellers can only create/edit/delete their own, admins can do it for anyone.
create policy "meetings_select_team" on public.meetings
  for select to authenticated using (true);
create policy "meetings_insert_own_or_admin" on public.meetings
  for insert to authenticated with check (seller_id = auth.uid() or public.is_admin());
create policy "meetings_update_own_or_admin" on public.meetings
  for update to authenticated using (seller_id = auth.uid() or public.is_admin());
create policy "meetings_delete_own_or_admin" on public.meetings
  for delete to authenticated using (seller_id = auth.uid() or public.is_admin());
