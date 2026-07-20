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
