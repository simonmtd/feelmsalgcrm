-- Feelm CRM: call tracking. Every phone call a seller/admin makes is logged
-- here — both calls to leads in the system (lead_id set) and cold calls to
-- companies outside the list (lead_id null, phone + company typed in). Feeds the
-- dashboard activity/hit-rate stats.

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  -- Null for a manual/cold call to someone not (yet) in the lead list.
  lead_id uuid references public.leads (id) on delete set null,
  company_name text,
  phone text,
  -- Reuses the call-outcome keys (no_answer, voicemail, interested, ...).
  outcome text,
  created_at timestamptz not null default now()
);

create index if not exists call_logs_seller_created_idx
  on public.call_logs (seller_id, created_at desc);
create index if not exists call_logs_created_idx
  on public.call_logs (created_at desc);

alter table public.call_logs enable row level security;

-- The whole team can see the call log (for the shared leaderboard/stats);
-- a seller can only log/delete their own, an admin can do it for anyone.
create policy "call_logs_select_team" on public.call_logs
  for select to authenticated using (true);
create policy "call_logs_insert_own_or_admin" on public.call_logs
  for insert to authenticated with check (seller_id = auth.uid() or public.is_admin());
create policy "call_logs_delete_own_or_admin" on public.call_logs
  for delete to authenticated using (seller_id = auth.uid() or public.is_admin());

-- Sellers write their own rows through the app's RLS client, so grant insert.
grant insert on public.call_logs to authenticated;
