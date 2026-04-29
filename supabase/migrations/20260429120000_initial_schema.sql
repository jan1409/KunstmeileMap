-- Initial schema for Kunstmeile Web App (Phase 1)
-- Tables: events, categories, tents, tent_photos, profiles, event_admins
-- Plus enums and a shared updated_at trigger function.

-- ENUMS
create type event_status as enum ('draft', 'published', 'archived');
create type user_role as enum ('admin', 'editor');
create type event_role as enum ('owner', 'editor');

-- EVENTS
create table events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title_de      text not null,
  title_en      text,
  year          int  not null,
  starts_at     date,
  ends_at       date,
  venue_name    text,
  venue_address text,
  splat_url     text,
  splat_origin  jsonb default '{"x":0,"y":0,"z":0}'::jsonb,
  splat_camera_default jsonb,
  status        event_status not null default 'draft',
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Only one featured event at a time
create unique index only_one_featured_event
  on events (is_featured) where is_featured = true;

-- CATEGORIES
create table categories (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  slug          text not null,
  name_de       text not null,
  name_en       text,
  icon          text,
  display_order int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (event_id, slug)
);

create index categories_by_event on categories(event_id);

-- TENTS
create table tents (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  slug            text not null,
  name            text not null,
  description_de  text,
  description_en  text,
  address         text,
  position        jsonb not null,
  category_id     uuid references categories(id) on delete set null,
  website_url     text,
  instagram_url   text,
  facebook_url    text,
  email_public    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  unique (event_id, slug)
);

create index tents_by_event on tents(event_id);
create index tents_by_category on tents(category_id);

-- TENT_PHOTOS
create table tent_photos (
  id                  uuid primary key default gen_random_uuid(),
  tent_id             uuid not null references tents(id) on delete cascade,
  storage_path        text not null,
  caption_de          text,
  caption_en          text,
  display_order       int  not null default 0,
  uploaded_at         timestamptz not null default now(),
  uploaded_by         uuid references auth.users(id),
  consent_recorded_at timestamptz default now()
);

create index photos_by_tent on tent_photos(tent_id);

-- PROFILES (extends auth.users)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'editor',
  created_at  timestamptz not null default now()
);

-- EVENT_ADMINS (per-event grant)
create table event_admins (
  event_id      uuid references events(id) on delete cascade,
  profile_id    uuid references profiles(id) on delete cascade,
  role_in_event event_role not null default 'editor',
  granted_at    timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_updated_at before update on events
  for each row execute function set_updated_at();

create trigger tents_updated_at before update on tents
  for each row execute function set_updated_at();
