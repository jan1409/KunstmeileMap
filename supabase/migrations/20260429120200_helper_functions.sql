-- Helper functions for RLS policies + auto-profile trigger.
-- These functions are referenced by the RLS policies in
-- 20260429120300_rls_policies.sql (and its sibling for profiles/event_admins).

-- is_admin: true when the calling user has profiles.role = 'admin'.
-- security definer so the function can read profiles even if the caller
-- has no SELECT permission yet (RLS hasn't been added at function-creation time
-- but will gate profiles.SELECT later — security definer bypasses RLS).
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

comment on function is_admin() is
  'True when the calling user has profiles.role = ''admin''. Used by RLS policies to allow global admins everything.';

-- has_event_role: true when the caller has any role on the given event.
-- min_role 'editor' allows owner+editor; min_role 'owner' allows only owner.
create or replace function has_event_role(eid uuid, min_role event_role default 'editor')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from event_admins
    where event_id = eid
      and profile_id = auth.uid()
      and (min_role = 'editor' or role_in_event = 'owner')
  );
$$;

comment on function has_event_role(uuid, event_role) is
  'True when the caller is granted at least the given role on the given event. Used by RLS policies on events, categories, tents, tent_photos, event_admins.';

-- handle_new_user: when a new auth.users row is inserted, auto-create a
-- matching profiles row with default role = 'editor'. Admins are promoted
-- separately via direct UPDATE on profiles (see seed in A1-T12).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'editor'
  );
  return new;
end;
$$;

comment on function handle_new_user() is
  'Trigger function that mirrors auth.users inserts into public.profiles with default role = editor.';

-- Trigger on auth.users so every new sign-up gets a profile row.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
