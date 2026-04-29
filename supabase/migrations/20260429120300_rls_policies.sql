-- RLS policies for events, categories, tents, tent_photos.
-- Reads: public can SELECT published events and their dependents.
-- Writes: only authenticated users with event-editor (or admin) roles.
-- Helpers used: is_admin(), has_event_role(uuid, event_role) — see 20260429120200_helper_functions.sql.

-- Enable RLS
alter table events       enable row level security;
alter table categories   enable row level security;
alter table tents        enable row level security;
alter table tent_photos  enable row level security;

-- ========================================================================
-- EVENTS
-- ========================================================================

-- SELECT: anyone can read published events; editors/owners read their own
-- draft/archived events; global admins read everything.
create policy events_public_read on events for select
  using (
    status = 'published'
    or has_event_role(id)
    or is_admin()
  );

-- INSERT: only global admins create events. (Per plan: editors are scoped
-- to events they're granted on, not allowed to spawn new events.)
create policy events_admin_insert on events for insert
  with check (is_admin());

-- UPDATE: event-owners or global admins.
create policy events_owner_update on events for update
  using (has_event_role(id, 'owner') or is_admin())
  with check (has_event_role(id, 'owner') or is_admin());

-- DELETE: only global admins. (Editors must request deletion.)
create policy events_admin_delete on events for delete
  using (is_admin());

-- ========================================================================
-- CATEGORIES
-- ========================================================================

-- SELECT: same visibility rule as the parent event.
create policy categories_public_read on categories for select
  using (
    exists (
      select 1 from events e
      where e.id = categories.event_id
        and (e.status = 'published' or has_event_role(e.id) or is_admin())
    )
  );

-- INSERT/UPDATE/DELETE: any event-editor for the parent event.
create policy categories_editor_write on categories for all
  using (has_event_role(event_id) or is_admin())
  with check (has_event_role(event_id) or is_admin());

-- ========================================================================
-- TENTS
-- ========================================================================

create policy tents_public_read on tents for select
  using (
    exists (
      select 1 from events e
      where e.id = tents.event_id
        and (e.status = 'published' or has_event_role(e.id) or is_admin())
    )
  );

create policy tents_editor_write on tents for all
  using (has_event_role(event_id) or is_admin())
  with check (has_event_role(event_id) or is_admin());

-- ========================================================================
-- TENT_PHOTOS
-- ========================================================================

-- SELECT: visible if the parent tent's event is visible.
create policy tent_photos_public_read on tent_photos for select
  using (
    exists (
      select 1 from tents t
      join events e on e.id = t.event_id
      where t.id = tent_photos.tent_id
        and (e.status = 'published' or has_event_role(e.id) or is_admin())
    )
  );

-- WRITE: any event-editor for the parent tent's event.
create policy tent_photos_editor_write on tent_photos for all
  using (
    exists (
      select 1 from tents t
      where t.id = tent_photos.tent_id
        and (has_event_role(t.event_id) or is_admin())
    )
  )
  with check (
    exists (
      select 1 from tents t
      where t.id = tent_photos.tent_id
        and (has_event_role(t.event_id) or is_admin())
    )
  );
