-- Feelm lead-fordelingssystem: lukk selvregistrering og stram inn lesetilgang
-- Run via `supabase db push` or paste into the Supabase SQL editor.
--
-- Before: the new-user trigger took the role from raw_user_meta_data, which the
-- signing-up user controls. With public signup on, anyone holding the (public)
-- anon key could sign up as role "admin" and read every lead. Now:
--   * role comes from raw_app_meta_data (settable only with the service role),
--   * self-signups are created INACTIVE (only admin-created users are active),
--   * team-wide read policies require an active profile,
--   * a deactivated admin is no longer an admin.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'seller' end,
    coalesce((new.raw_app_meta_data ->> 'invited')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;

-- Niches: only active members.
drop policy if exists "niches_select_authenticated" on public.niches;
create policy "niches_select_authenticated" on public.niches
  for select to authenticated using (public.is_active_member());

-- Meetings: your own (team views are built server-side), admins see all.
drop policy if exists "meetings_select_team" on public.meetings;
create policy "meetings_select_team" on public.meetings
  for select to authenticated using (
    public.is_active_member() and (seller_id = auth.uid() or public.is_admin())
  );
drop policy if exists "meetings_insert_own_or_admin" on public.meetings;
create policy "meetings_insert_own_or_admin" on public.meetings
  for insert to authenticated with check (
    public.is_active_member() and (seller_id = auth.uid() or public.is_admin())
  );

-- Call logs: your own, admins see all (team stats are built server-side).
drop policy if exists "call_logs_select_team" on public.call_logs;
create policy "call_logs_select_team" on public.call_logs
  for select to authenticated using (
    public.is_active_member() and (seller_id = auth.uid() or public.is_admin())
  );
drop policy if exists "call_logs_insert_own_or_admin" on public.call_logs;
create policy "call_logs_insert_own_or_admin" on public.call_logs
  for insert to authenticated with check (
    public.is_active_member() and (seller_id = auth.uid() or public.is_admin())
  );
