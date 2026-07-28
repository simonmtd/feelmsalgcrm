-- Feelm Leads — komplett databaseoppsett
-- Lim hele denne fila inn i Supabase SQL-editoren og kjør én gang.
-- Bygget fra migrasjonene 0001–0006 i rekkefølge.


-- ======================================================================
-- 0001_init.sql
-- ======================================================================
-- Feelm lead-fordelingssystem: initial schema
-- Run via `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- niches
-- ---------------------------------------------------------------------------
create table if not exists public.niches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'seller' check (role in ('seller', 'admin')),
  active_niche_id uuid references public.niches (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created (e.g. via
-- the admin panel's "create seller" action, which uses the Supabase Admin API).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'seller')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  hubspot_contact_id text unique,
  company_name text,
  contact_name text,
  email text,
  phone text,
  niche_id uuid references public.niches (id) on delete set null,
  source text not null default 'hubspot' check (source in ('apollo', 'hubspot', 'manual')),
  status text not null default 'new' check (status in ('new', 'assigned', 'contacted', 'follow_up', 'won', 'lost')),
  deal_size numeric,
  filming_status text not null default 'not_started' check (filming_status in ('not_started', 'scheduled', 'filmed', 'delivered')),
  assigned_to uuid references public.profiles (id) on delete set null,
  assigned_date date,
  next_follow_up_at timestamptz,
  raw_hubspot_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists leads_niche_status_idx on public.leads (niche_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lead_activities ("hva som er sagt" — notat-/samtale-/statuslogg)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  seller_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('note', 'call', 'email', 'status_change', 'filming_update')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_id_idx on public.lead_activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- sync_runs (HubSpot sync job log)
-- ---------------------------------------------------------------------------
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_synced integer not null default 0,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  error text
);

-- ---------------------------------------------------------------------------
-- app_settings (simple key/value store, e.g. daily_lead_count)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);

insert into public.app_settings (key, value)
values ('daily_lead_count', '10'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.niches enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.sync_runs enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- niches: any authenticated user can read; only admins can write
create policy "niches_select_authenticated" on public.niches
  for select to authenticated using (true);
create policy "niches_write_admin" on public.niches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles: users read/update their own row; admins read/update all
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_write_admin" on public.profiles
  for insert to authenticated with check (public.is_admin());
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated using (public.is_admin());

-- leads: sellers see/update only their assigned leads; admins see/update all
create policy "leads_select_own_or_admin" on public.leads
  for select to authenticated using (assigned_to = auth.uid() or public.is_admin());
create policy "leads_update_own_or_admin" on public.leads
  for update to authenticated using (assigned_to = auth.uid() or public.is_admin());
create policy "leads_write_admin" on public.leads
  for insert to authenticated with check (public.is_admin());
create policy "leads_delete_admin" on public.leads
  for delete to authenticated using (public.is_admin());

-- lead_activities: sellers see/add activity on their own leads; admins all
create policy "lead_activities_select" on public.lead_activities
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.leads
      where leads.id = lead_activities.lead_id and leads.assigned_to = auth.uid()
    )
  );
create policy "lead_activities_insert" on public.lead_activities
  for insert to authenticated with check (
    public.is_admin() or exists (
      select 1 from public.leads
      where leads.id = lead_activities.lead_id and leads.assigned_to = auth.uid()
    )
  );

-- sync_runs & app_settings: admin only (cron jobs use the service role key,
-- which bypasses RLS entirely)
create policy "sync_runs_admin" on public.sync_runs
  for select to authenticated using (public.is_admin());
create policy "app_settings_select_admin" on public.app_settings
  for select to authenticated using (public.is_admin());
create policy "app_settings_write_admin" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ======================================================================
-- 0002_meetings.sql
-- ======================================================================
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

-- ======================================================================
-- 0003_meeting_sales_details.sql
-- ======================================================================
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

-- ======================================================================
-- 0004_harden_rls.sql
-- ======================================================================
-- Feelm lead-fordelingssystem: RLS-herding
-- Run via `supabase db push` or paste into the Supabase SQL editor.
--
-- Background: the original UPDATE policies had a USING clause but no WITH CHECK
-- and no column-level grants. USING only decides WHICH rows a user may touch —
-- without WITH CHECK + column grants, an authenticated user could PATCH their
-- own row to any values via a direct PostgREST call (the anon key ships to the
-- browser). Concretely a seller could set profiles.role = 'admin', or move a
-- lead's assigned_to to someone else. This migration closes both holes.
--
-- All *admin* writes in the app go through the service-role client, which
-- bypasses RLS and these grants entirely, so restricting the `authenticated`
-- role does not affect admin functionality.

-- ---------------------------------------------------------------------------
-- profiles: a user may only update their own row, and only active_niche_id.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

revoke update on public.profiles from authenticated;
grant update (active_niche_id) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- leads: a seller may update their own assigned leads but cannot reassign them
-- (WITH CHECK keeps assigned_to = self) or re-classify them (column grant limits
-- writes to the seller workflow columns). Admins still do everything via the
-- service-role client.
-- ---------------------------------------------------------------------------
drop policy if exists "leads_update_own_or_admin" on public.leads;
create policy "leads_update_own_or_admin" on public.leads
  for update to authenticated
  using (assigned_to = auth.uid() or public.is_admin())
  with check (assigned_to = auth.uid() or public.is_admin());

revoke update on public.leads from authenticated;
grant update (status, filming_status, deal_size, next_follow_up_at)
  on public.leads to authenticated;

-- ---------------------------------------------------------------------------
-- meetings: an update must keep the meeting owned by the same seller (or admin),
-- so a seller can't hand their meeting to someone else.
-- ---------------------------------------------------------------------------
drop policy if exists "meetings_update_own_or_admin" on public.meetings;
create policy "meetings_update_own_or_admin" on public.meetings
  for update to authenticated
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

-- ======================================================================
-- 0005_audit_log.sql
-- ======================================================================
-- Feelm lead-fordelingssystem: audit log for admin actions
-- Run via `supabase db push` or paste into the Supabase SQL editor.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text not null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Only admins may read the log. Writes go through the service-role client
-- (which bypasses RLS), so there is deliberately no insert policy for the
-- authenticated role — an ordinary user can never forge or delete entries.
create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.is_admin());

-- ======================================================================
-- 0006_notifications.sql
-- ======================================================================
-- Feelm lead-fordelingssystem: in-app notifications for sellers
-- Run via `supabase db push` or paste into the Supabase SQL editor.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'lead_assigned'
    check (type in ('lead_assigned', 'lead_reassigned', 'system')),
  message text not null,
  lead_id uuid references public.leads (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- A user sees only their own notifications. Writes come from the service-role
-- client (admin actions / cron), so there is no insert policy for the
-- authenticated role. Users may only flip read_at (marking as read).
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
