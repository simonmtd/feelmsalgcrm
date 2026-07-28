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
