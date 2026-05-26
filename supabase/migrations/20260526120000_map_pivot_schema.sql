-- Map pivot: replace 3D position (jsonb x/y/z) on tents with 2D lat/lng,
-- drop splat-* fields on events, and add per-event default map view.
-- Re-create duplicate_event RPC referencing the new columns.
--
-- Phase 1 pivots from a photoreal Gaussian-Splat scene to a Leaflet+OSM 2D
-- map. The 3D-only columns (tents.position, events.splat_*) become dead
-- weight; we drop them here so the regenerated supabase types stop offering
-- them to the application code. The existing position_xyz_shape /
-- splat_origin_xyz_shape CHECK constraints are dropped implicitly by
-- DROP COLUMN.

-- ===== tents: drop position, add lat/lng =====
alter table tents drop column position;
alter table tents add column lat double precision;
alter table tents add column lng double precision;

-- Allow lat+lng to be NULL together (tent placed-on-map not yet decided),
-- but if one is set the other must be set and both must be in WGS84 range.
alter table tents add constraint tents_latlng_range_chk
  check (
    (lat is null) = (lng is null)
    and (lat is null or lat between -90 and 90)
    and (lng is null or lng between -180 and 180)
  );

-- Spatial-ish index for the public viewer which loads all tents per event.
-- Partial: NULL coords don't need indexing.
create index tents_lat_lng_idx
  on tents (lat, lng)
  where lat is not null and lng is not null;

comment on column tents.lat is
  'WGS84 latitude in decimal degrees. NULL when tent has not been placed on the map yet (paired with lng — both NULL or both set, enforced by tents_latlng_range_chk).';
comment on column tents.lng is
  'WGS84 longitude in decimal degrees. NULL when tent has not been placed on the map yet (paired with lat — both NULL or both set, enforced by tents_latlng_range_chk).';

-- ===== events: drop splat fields, add map defaults =====
alter table events drop column splat_url;
alter table events drop column splat_origin;
alter table events drop column splat_camera_default;

-- Per-event default map view. NOT NULL with placeholder defaults pointing at
-- Karlsruhe city center (49.0, 8.4) at street level (zoom 17). Real values
-- are set by the event-settings UI (admin) once T4 ships.
alter table events add column default_lat  double precision not null default 49.0;
alter table events add column default_lng  double precision not null default 8.4;
alter table events add column default_zoom smallint         not null default 17;

alter table events add constraint events_default_latlng_range_chk
  check (
    default_lat between -90 and 90
    and default_lng between -180 and 180
  );

-- Leaflet's max OSM zoom is 19; min usable for an event-level overview is ~3.
-- default_zoom is constrained to 1-22 (defensive headroom). The user-facing
-- input clamps to 1-19 matching standard OSM tile zoom levels; the extra
-- headroom permits future tile sources without a migration.
alter table events add constraint events_default_zoom_range_chk
  check (default_zoom between 1 and 22);

comment on column events.default_lat is
  'Default map center latitude (WGS84) for this event. Used as the public viewer initial view and the "back to overview" target.';
comment on column events.default_lng is
  'Default map center longitude (WGS84) for this event.';
comment on column events.default_zoom is
  'Default Leaflet zoom level for this event (OSM tiles support 1..19; admin UI clamps at the high end).';

-- ===== duplicate_event RPC =====
-- The existing function (last defined in 20260501120000_tent_numbers_and_multi_category.sql)
-- references the now-dropped tents.position, events.splat_url, events.splat_origin,
-- events.splat_camera_default. Drop and recreate. The signature changes too
-- (the clone_tent_positions and clone_splat_url toggles go away) so CREATE OR
-- REPLACE cannot be used — must DROP then CREATE.

drop function if exists public.duplicate_event(uuid, text, text, int, boolean, boolean, boolean, boolean);

create function duplicate_event(
  source_event_id uuid,
  new_slug text,
  new_title_de text,
  new_year int,
  clone_categories boolean default true,
  clone_tents boolean default true,
  clone_tent_positions boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  src events%rowtype;
  new_id uuid;
  cat_map jsonb := '{}'::jsonb;
  cat_record record;
begin
  -- Permission check.
  if not (has_event_role(source_event_id, 'owner') or is_admin()) then
    raise exception 'permission denied: duplicate_event requires owner role on source event or global admin';
  end if;

  select * into src from events where id = source_event_id;
  if not found then
    raise exception 'source event % not found', source_event_id;
  end if;

  -- Insert the new event row. Title_en + venue are carried over verbatim;
  -- the new default_lat/default_lng/default_zoom view is also copied so a
  -- duplicate opens to the same map view as its source. Status forced to
  -- draft; featured forced off (avoids the only_one_featured_event index
  -- conflict and matches "duplicates are work in progress" semantics).
  insert into events (
    slug,
    title_de,
    title_en,
    year,
    venue_name,
    venue_address,
    default_lat,
    default_lng,
    default_zoom,
    status,
    is_featured
  )
  values (
    new_slug,
    new_title_de,
    src.title_en,
    new_year,
    src.venue_name,
    src.venue_address,
    src.default_lat,
    src.default_lng,
    src.default_zoom,
    'draft',
    false
  )
  returning id into new_id;

  -- Clone categories first; build the slug -> new id map for the tent step.
  if clone_categories then
    for cat_record in
      insert into categories (event_id, slug, name_de, name_en, icon, display_order)
      select new_id, c.slug, c.name_de, c.name_en, c.icon, c.display_order
      from categories c
      where c.event_id = source_event_id
      returning id, slug
    loop
      cat_map := cat_map || jsonb_build_object(cat_record.slug, cat_record.id);
    end loop;
  end if;

  -- Clone tents. display_number is copied verbatim from the source tent:
  -- per-event scope means no uniqueness conflict with the new event.
  -- lat/lng carry-over is gated by clone_tent_positions (same UX as before;
  -- duplicates may want to re-place tents on a different venue).
  -- category_id no longer exists on tents; tent_categories is populated
  -- separately below after the tent rows are inserted.
  if clone_tents then
    insert into tents (
      event_id,
      slug,
      name,
      description_de,
      description_en,
      address,
      lat,
      lng,
      display_number,
      website_url,
      instagram_url,
      facebook_url,
      email_public,
      created_by,
      updated_by
    )
    select
      new_id,
      t.slug,
      t.name,
      t.description_de,
      t.description_en,
      t.address,
      case when clone_tent_positions then t.lat else null end,
      case when clone_tent_positions then t.lng else null end,
      t.display_number,
      t.website_url,
      t.instagram_url,
      t.facebook_url,
      t.email_public,
      auth.uid(),
      auth.uid()
    from tents t
    where t.event_id = source_event_id;

    -- Mirror tent_categories using the cat_map built above. Joins go:
    -- new tent → matching source tent (same slug, source event) →
    -- source tent_categories → source category (for the slug key into cat_map).
    -- Only runs when both clone_tents and clone_categories are true; otherwise
    -- cat_map is empty and there are no categories to link anyway.
    if clone_categories then
      insert into tent_categories (tent_id, category_id)
      select new_t.id, (cat_map ->> c.slug)::uuid
      from tents new_t
      join tents src_t
        on src_t.event_id = source_event_id
       and src_t.slug = new_t.slug
      join tent_categories tc on tc.tent_id = src_t.id
      join categories c on c.id = tc.category_id
      where new_t.event_id = new_id
        and (cat_map ? c.slug);
    end if;
  end if;

  -- Grant the duplicating user owner on the new event so they can keep
  -- editing immediately. on conflict do nothing covers the case where the
  -- caller is a global admin who's already in event_admins for some reason.
  insert into event_admins (event_id, profile_id, role_in_event)
  values (new_id, auth.uid(), 'owner')
  on conflict do nothing;

  return new_id;
end;
$$;

comment on function duplicate_event(uuid, text, text, int, boolean, boolean, boolean) is
  'Clone an event (and optionally its categories, tents, tent lat/lng coordinates) into a new draft event. Caller must be owner of the source event or a global admin. Grants caller owner on the new event. The duplicated event inherits the source event''s default_lat/default_lng/default_zoom map view.';

revoke all on function duplicate_event(uuid, text, text, int, boolean, boolean, boolean) from public;
grant execute on function duplicate_event(uuid, text, text, int, boolean, boolean, boolean) to authenticated;
