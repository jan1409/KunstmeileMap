-- Tent numbering + multi-category support.
-- 1) Add tents.display_number (per-event unique).
-- 2) Create tent_categories join table.
-- 3) Backfill: existing tents get sequential numbers per event ordered by
--    created_at; existing tents.category_id rows are mirrored into the join.
-- 4) Drop tents.category_id (single-cat is fully replaced by the join).
-- 5) RLS for tent_categories mirrors tents (admin or event_admins write,
--    everyone reads).
-- 6) INSERT trigger on tents auto-fills display_number with max+1 per event
--    when the caller leaves it NULL.

-- ===== 1. display_number column =====
alter table tents add column display_number int;

-- ===== 2. join table =====
create table tent_categories (
  tent_id     uuid references tents(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  primary key (tent_id, category_id)
);
create index tent_categories_by_category on tent_categories(category_id);

-- ===== 3. backfill =====
-- Numbers: row_number per event, ordered by created_at then id for stability.
update tents t set display_number = sub.rn
from (
  select id,
         row_number() over (partition by event_id order by created_at, id) as rn
  from tents
) sub
where t.id = sub.id;

-- Categories: mirror current single category into the join table.
insert into tent_categories (tent_id, category_id)
select id, category_id from tents where category_id is not null;

-- ===== 4. drop the old single-category column =====
alter table tents drop column category_id;

-- ===== 5. unique constraint on display_number per event =====
-- Partial unique index allows NULL (would only happen briefly between INSERT
-- and the BEFORE trigger; defensive).
--
-- Concurrency note: the trigger below reads max(display_number) per
-- event_id without a lock. Two simultaneous INSERTs in the same event
-- could each pick the same max+1; this unique index catches the conflict
-- and the second INSERT fails with a duplicate-key error which the UI
-- surfaces. Acceptable at single-admin concurrency; for higher
-- concurrency we'd swap to SELECT … FOR UPDATE on a per-event lock row
-- or pg_advisory_xact_lock(event_id) inside the trigger.
create unique index tents_display_number_per_event
  on tents (event_id, display_number)
  where display_number is not null;

-- ===== 6. RLS for tent_categories =====
alter table tent_categories enable row level security;

-- SELECT: anyone (matches tents — public viewer needs to see categories).
create policy tent_categories_public_read on tent_categories for select
  using (true);

-- INSERT/UPDATE/DELETE: admins or event_admins on the parent tent's event.
create policy tent_categories_admin_write on tent_categories for all
  using (
    is_admin()
    or exists (
      select 1 from tents t
      where t.id = tent_categories.tent_id
        and has_event_role(t.event_id, 'editor')
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from tents t
      where t.id = tent_categories.tent_id
        and has_event_role(t.event_id, 'editor')
    )
  );

-- ===== 7. auto-number trigger =====
create or replace function tents_assign_display_number()
returns trigger
language plpgsql
as $$
begin
  if new.display_number is null then
    select coalesce(max(display_number), 0) + 1
      into new.display_number
      from tents
      where event_id = new.event_id;
  end if;
  return new;
end;
$$;

create trigger tents_before_insert_display_number
  before insert on tents
  for each row execute function tents_assign_display_number();

comment on column tents.display_number is
  'Sequential per-event tent number rendered on the map. Auto-filled on INSERT via tents_assign_display_number(); admin may override. The trigger fires only on INSERT — clearing this column to NULL via UPDATE persists as NULL and does NOT auto-renumber. Unique per (event_id, display_number) when not null.';
comment on table tent_categories is
  'Many-to-many tent ↔ category join. Replaced tents.category_id in the 2026-05-01 migration.';

-- ===== 8. update duplicate_event RPC for the new schema =====
-- The old duplicate_event references the now-dropped tents.category_id column.
-- We replace it with a version that copies display_number from the source
-- (per-event scope means no conflict) and mirrors tent_categories via cat_map.

create or replace function duplicate_event(
  source_event_id uuid,
  new_slug text,
  new_title_de text,
  new_year int,
  clone_categories boolean default true,
  clone_tents boolean default true,
  clone_tent_positions boolean default true,
  clone_splat_url boolean default true
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

  -- Insert the new event row. Title_en is carried over verbatim; venue +
  -- splat config are also copied (splat_url optional). Status forced to draft;
  -- featured forced off (avoids the only_one_featured_event index conflict
  -- and matches "duplicates are work in progress" semantics).
  insert into events (
    slug,
    title_de,
    title_en,
    year,
    venue_name,
    venue_address,
    splat_url,
    splat_origin,
    splat_camera_default,
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
    case when clone_splat_url then src.splat_url else null end,
    src.splat_origin,
    src.splat_camera_default,
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
      position,
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
      case
        when clone_tent_positions then t.position
        else '{"x":0,"y":0,"z":0}'::jsonb
      end,
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

comment on function duplicate_event(uuid, text, text, int, boolean, boolean, boolean, boolean) is
  'Clone an event (and optionally its categories, tents, tent positions, splat URL) into a new draft event. Caller must be owner of the source event or a global admin. Grants caller owner on the new event.';

revoke all on function duplicate_event(uuid, text, text, int, boolean, boolean, boolean, boolean) from public;
grant execute on function duplicate_event(uuid, text, text, int, boolean, boolean, boolean, boolean) to authenticated;
