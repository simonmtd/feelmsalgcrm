-- Feelm lead-fordelingssystem: provisjon per kvalifisert møte
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- A seller claims commission on a meeting (with a required note). Every Friday
-- the claimed meetings that have taken place are reported to the admins, who
-- approve or reject each one. The amount is stored per meeting so a later rate
-- change never rewrites history.
alter table public.meetings
  add column if not exists commission_claimed boolean not null default false,
  add column if not exists commission_amount integer not null default 500,
  add column if not exists commission_status text not null default 'pending'
    check (commission_status in ('pending', 'approved', 'rejected')),
  add column if not exists commission_reported_at timestamptz,
  add column if not exists commission_reviewed_at timestamptz,
  add column if not exists commission_reviewed_by uuid references public.profiles (id) on delete set null;

create index if not exists meetings_commission_idx
  on public.meetings (commission_status, starts_at)
  where commission_claimed;

-- Sellers can update/delete their own meetings (RLS), so guard the commission
-- fields: only admins (or the service role, where auth.uid() is null) may
-- review, and a reviewed meeting is frozen for the seller.
create or replace function public.guard_meeting_commission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    new.commission_status := 'pending';
    new.commission_amount := 500;
    new.commission_reported_at := null;
    new.commission_reviewed_at := null;
    new.commission_reviewed_by := null;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.commission_claimed and old.commission_status <> 'pending' then
      raise exception 'Møtet er allerede behandlet for provisjon og kan ikke slettes';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.commission_status is distinct from old.commission_status
     or new.commission_amount is distinct from old.commission_amount
     or new.commission_reported_at is distinct from old.commission_reported_at
     or new.commission_reviewed_at is distinct from old.commission_reviewed_at
     or new.commission_reviewed_by is distinct from old.commission_reviewed_by then
    raise exception 'Bare admin kan behandle provisjon';
  end if;
  if old.commission_claimed and old.commission_status <> 'pending'
     and (new.commission_claimed is distinct from old.commission_claimed
          or new.notes is distinct from old.notes
          or new.starts_at is distinct from old.starts_at
          or new.seller_id is distinct from old.seller_id) then
    raise exception 'Møtet er allerede behandlet for provisjon og kan ikke endres';
  end if;
  return new;
end;
$$;

drop trigger if exists meetings_guard_commission on public.meetings;
create trigger meetings_guard_commission
  before insert or update or delete on public.meetings
  for each row execute function public.guard_meeting_commission();
