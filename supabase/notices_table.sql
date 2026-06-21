-- Notices table for Attendy EDU
-- Run this in Supabase SQL editor (or add to your migrations) before using NoticesScreen.
-- Mirrors the organisation-scoping pattern used by members / attendance_logs / notifications_log.

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notices_org_idx on public.notices (organisation_id, pinned desc, created_at desc);

alter table public.notices enable row level security;

-- Anyone belonging to the organisation can read its notices.
create policy "notices_select_org_members"
  on public.notices for select
  using (
    exists (
      select 1 from public.org_users ou
      where ou.organisation_id = notices.organisation_id
        and ou.user_id = auth.uid()
        and ou.is_active = true
    )
  );

-- Only admins can create notices for their organisation.
create policy "notices_insert_admin"
  on public.notices for insert
  with check (
    exists (
      select 1 from public.org_users ou
      where ou.organisation_id = notices.organisation_id
        and ou.user_id = auth.uid()
        and ou.is_active = true
        and ou.role = 'admin'
    )
  );

-- Only admins can update (pin/unpin) or delete notices for their organisation.
create policy "notices_update_admin"
  on public.notices for update
  using (
    exists (
      select 1 from public.org_users ou
      where ou.organisation_id = notices.organisation_id
        and ou.user_id = auth.uid()
        and ou.is_active = true
        and ou.role = 'admin'
    )
  );

create policy "notices_delete_admin"
  on public.notices for delete
  using (
    exists (
      select 1 from public.org_users ou
      where ou.organisation_id = notices.organisation_id
        and ou.user_id = auth.uid()
        and ou.is_active = true
        and ou.role = 'admin'
    )
  );
