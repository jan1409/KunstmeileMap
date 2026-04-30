-- duplicate_event(): clone an existing event into a new one with a fresh slug,
-- title and year. Optional toggles for cloning categories, tents (with optional
-- position carry-over), and the splat URL. Always creates the new event in
-- 'draft' status and never marks it featured (the only_one_featured_event
-- unique index makes that an obvious gotcha to avoid).
--
-- Permission gate: caller must be an OWNER on the source event or a global
-- admin. We re-check this inside the function rather than relying solely on
-- RLS because the function runs with security definer.
--
-- The cat_map jsonb tracks { old_category.slug -> new_category.id } so that
-- cloned tents' category_id can be rewritten in one INSERT...SELECT pass.

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

  -- Clone tents. category_id is rewritten via cat_map: look up the OLD
  -- category's slug from the source-event categories, then translate to the
  -- NEW category's id. If clone_categories=false, cat_map is empty and every
  -- tent ends up with category_id = null (no broken FK).
  if clone_tents then
    insert into tents (
      event_id,
      slug,
      name,
      description_de,
      description_en,
      address,
      position,
      category_id,
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
      (cat_map ->> (select c.slug from categories c where c.id = t.category_id))::uuid,
      t.website_url,
      t.instagram_url,
      t.facebook_url,
      t.email_public,
      auth.uid(),
      auth.uid()
    from tents t
    where t.event_id = source_event_id;
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
