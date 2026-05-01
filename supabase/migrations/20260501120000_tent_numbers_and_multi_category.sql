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
  'Sequential per-event tent number rendered on the map. Auto-filled on insert via tents_assign_display_number(); admin may override. Unique per (event_id, display_number) when not null.';
comment on table tent_categories is
  'Many-to-many tent ↔ category join. Replaced tents.category_id in the 2026-05-01 migration.';
