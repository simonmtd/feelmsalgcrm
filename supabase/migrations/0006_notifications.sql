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
