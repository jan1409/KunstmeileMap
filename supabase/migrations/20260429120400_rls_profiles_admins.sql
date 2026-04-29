-- RLS policies for profiles and event_admins.
-- profiles: users see + edit only their own row; admins see/edit all.
-- event_admins: caller sees their own grants; event-owners + admins manage grants.

-- ========================================================================
-- PROFILES
-- ========================================================================

alter table profiles enable row level security;

-- SELECT: own profile + admins see all.
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or is_admin());

-- INSERT: only own row (or admin). Note: the handle_new_user trigger inserts
-- via security definer, bypassing this — so the trigger continues to work.
create policy profiles_self_insert on profiles for insert
  with check (id = auth.uid() or is_admin());

-- UPDATE: own row, but cannot self-promote role. Admins can update freely.
create policy profiles_self_update on profiles for update
  using (id = auth.uid() or is_admin())
  with check (
    is_admin()
    or (
      id = auth.uid()
      -- non-admins cannot escalate their role
      and role = (select p.role from profiles p where p.id = auth.uid())
    )
  );

-- DELETE: only admins (typically cascaded from auth.users delete anyway).
create policy profiles_admin_delete on profiles for delete
  using (is_admin());

-- ========================================================================
-- EVENT_ADMINS
-- ========================================================================

alter table event_admins enable row level security;

-- SELECT: own grants, plus event-owners + global admins.
create policy event_admins_self_read on event_admins for select
  using (
    profile_id = auth.uid()
    or has_event_role(event_id, 'owner')
    or is_admin()
  );

-- INSERT/UPDATE/DELETE: only event-owners and global admins manage grants.
create policy event_admins_owner_write on event_admins for all
  using (has_event_role(event_id, 'owner') or is_admin())
  with check (has_event_role(event_id, 'owner') or is_admin());
