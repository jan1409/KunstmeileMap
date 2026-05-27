-- Role management: updates RLS policies, helper functions, and the auto-profile
-- trigger to support the new 'contributor' tier (introduced in 20260527130000).
-- Adds two SECURITY DEFINER RPCs that the frontend needs.

-- ========================================================================
-- 1. has_event_role — three-tier case logic
-- ========================================================================

create or replace function public.has_event_role(eid uuid, min_role event_role default 'editor')
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
      and case min_role
        when 'contributor' then role_in_event in ('contributor', 'editor', 'owner')
        when 'editor'      then role_in_event in ('editor', 'owner')
        when 'owner'       then role_in_event = 'owner'
      end
  );
$$;

comment on function has_event_role(uuid, event_role) is
  'True when the caller has at least the given role on the given event. Three-tier: contributor < editor < owner.';

-- ========================================================================
-- 2. tents — split FOR ALL into INSERT/UPDATE/DELETE with different gates
-- ========================================================================

drop policy if exists tents_editor_write on tents;

-- INSERT/DELETE: editor or owner (contributor cannot create/delete).
create policy tents_editor_insert on tents for insert
  with check (has_event_role(event_id, 'editor') or is_admin());

create policy tents_editor_delete on tents for delete
  using (has_event_role(event_id, 'editor') or is_admin());

-- UPDATE: contributor or above (contributor can edit existing stands).
create policy tents_contributor_update on tents for update
  using (has_event_role(event_id, 'contributor') or is_admin())
  with check (has_event_role(event_id, 'contributor') or is_admin());

-- ========================================================================
-- 3. tent_photos — lower the bar to 'contributor' for all writes
-- ========================================================================

drop policy if exists tent_photos_editor_write on tent_photos;

create policy tent_photos_contributor_write on tent_photos for all
  using (
    exists (
      select 1 from tents t
      where t.id = tent_photos.tent_id
        and (has_event_role(t.event_id, 'contributor') or is_admin())
    )
  )
  with check (
    exists (
      select 1 from tents t
      where t.id = tent_photos.tent_id
        and (has_event_role(t.event_id, 'contributor') or is_admin())
    )
  );

-- ========================================================================
-- 4. tent_categories — lower the bar to 'contributor' (contributors assign
--    categories to existing stands as part of editing)
-- ========================================================================

drop policy if exists tent_categories_admin_write on tent_categories;

create policy tent_categories_contributor_write on tent_categories for all
  using (
    is_admin()
    or exists (
      select 1 from tents t
      where t.id = tent_categories.tent_id
        and has_event_role(t.event_id, 'contributor')
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from tents t
      where t.id = tent_categories.tent_id
        and has_event_role(t.event_id, 'contributor')
    )
  );

-- ========================================================================
-- 5. Storage bucket 'tent-photos' — mirror the table-level lower bar
-- ========================================================================

drop policy if exists "tent_photos_editor_insert" on storage.objects;
drop policy if exists "tent_photos_editor_update" on storage.objects;
drop policy if exists "tent_photos_editor_delete" on storage.objects;

create policy "tent_photos_contributor_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid, 'contributor')
      or is_admin()
    )
  );

create policy "tent_photos_contributor_update"
  on storage.objects for update
  using (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid, 'contributor')
      or is_admin()
    )
  );

create policy "tent_photos_contributor_delete"
  on storage.objects for delete
  using (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid, 'contributor')
      or is_admin()
    )
  );

-- ========================================================================
-- 6. handle_new_user — read invitation metadata, materialize event_admins row
-- ========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_event uuid;
  invited_role event_role;
begin
  -- Existing behavior: create profile row with default global role 'editor'.
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'editor'
  );

  -- New: if the invite metadata is present (set by the invite-user Edge
  -- Function via inviteUserByEmail's `data` param), materialize the
  -- event_admins membership. Both fields must be present and parseable.
  invited_event := nullif(new.raw_user_meta_data ->> 'invited_event_id', '')::uuid;
  invited_role  := nullif(new.raw_user_meta_data ->> 'invited_role', '')::event_role;
  if invited_event is not null and invited_role is not null then
    insert into public.event_admins (event_id, profile_id, role_in_event)
    values (invited_event, new.id, invited_role)
    on conflict (event_id, profile_id) do update set role_in_event = excluded.role_in_event;
  end if;
  return new;
end;
$$;

comment on function handle_new_user() is
  'Trigger: mirror auth.users inserts into public.profiles. If invite metadata is present (invited_event_id + invited_role), also create the event_admins row.';

-- ========================================================================
-- 7. get_event_permissions(eid) — the 4-boolean RPC the frontend needs
-- ========================================================================

create or replace function public.get_event_permissions(eid uuid)
returns table (
  can_access boolean,
  can_contribute boolean,
  can_edit boolean,
  can_own boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin() or has_event_role(eid, 'contributor') as can_access,
    is_admin() or has_event_role(eid, 'contributor') as can_contribute,
    is_admin() or has_event_role(eid, 'editor')      as can_edit,
    is_admin() or has_event_role(eid, 'owner')       as can_own;
$$;

comment on function get_event_permissions(uuid) is
  'Returns the four event-scoped permission booleans for the caller. UI uses this to gate buttons + routes.';

grant execute on function public.get_event_permissions(uuid) to authenticated;

-- ========================================================================
-- 8. get_event_users(eid) — owner-only user list with auth metadata
-- ========================================================================

create or replace function public.get_event_users(eid uuid)
returns table (
  profile_id uuid,
  email text,
  full_name text,
  role_in_event event_role,
  email_confirmed_at timestamptz,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ea.profile_id,
    au.email::text,
    p.full_name,
    ea.role_in_event,
    au.email_confirmed_at,
    au.created_at as invited_at
  from event_admins ea
    join profiles p on p.id = ea.profile_id
    join auth.users au on au.id = ea.profile_id
  where ea.event_id = eid
    and (is_admin() or has_event_role(eid, 'owner'));
$$;

comment on function get_event_users(uuid) is
  'Returns the user list for an event, joined with auth.users for email/email_confirmed_at. Owner+admin only.';

grant execute on function public.get_event_users(uuid) to authenticated;
