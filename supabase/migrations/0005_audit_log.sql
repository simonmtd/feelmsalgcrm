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
