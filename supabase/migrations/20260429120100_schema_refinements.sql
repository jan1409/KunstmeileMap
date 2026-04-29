-- Schema refinements after code review of 20260429120000_initial_schema.sql.
-- Addresses code-review items I-1 (FK delete asymmetry), I-2 (position shape),
-- I-3 (consent default semantics), I-5 (uploaded_at naming), M-1 (column docs).

-- I-1: switch user-reference FKs to ON DELETE SET NULL so deleting an auth
-- user doesn't fail on existing tents/photos.

alter table tents
  drop constraint if exists tents_created_by_fkey,
  drop constraint if exists tents_updated_by_fkey,
  add constraint tents_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  add constraint tents_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;

alter table tent_photos
  drop constraint if exists tent_photos_uploaded_by_fkey,
  add constraint tent_photos_uploaded_by_fkey
    foreign key (uploaded_by) references auth.users(id) on delete set null;

-- I-2: enforce {x:number, y:number, z:number} shape on jsonb positions.

alter table tents
  add constraint position_xyz_shape check (
    jsonb_typeof(position) = 'object'
    and jsonb_typeof(position -> 'x') = 'number'
    and jsonb_typeof(position -> 'y') = 'number'
    and jsonb_typeof(position -> 'z') = 'number'
  );

alter table events
  add constraint splat_origin_xyz_shape check (
    splat_origin is null or (
      jsonb_typeof(splat_origin) = 'object'
      and jsonb_typeof(splat_origin -> 'x') = 'number'
      and jsonb_typeof(splat_origin -> 'y') = 'number'
      and jsonb_typeof(splat_origin -> 'z') = 'number'
    )
  );

-- I-3: drop the consent_recorded_at default. Application code MUST set this
-- explicitly when consent is actually recorded; an unset value means consent
-- not (yet) recorded, not "consent existed at upload time".

alter table tent_photos
  alter column consent_recorded_at drop default;

-- I-5: rename uploaded_at -> created_at for consistency with other tables.

alter table tent_photos rename column uploaded_at to created_at;

-- M-1: column documentation for load-bearing fields.

comment on table events is
  'One exhibition occurrence (e.g. "Kunstmeile 2026"). Multi-event scoped: every other table joins through events.id.';

comment on column events.is_featured is
  'When true, this is the homepage default. The unique partial index only_one_featured_event enforces at most one featured event at a time.';

comment on column events.splat_origin is
  '{x, y, z} world-coordinate offset for the .splat scene origin. Adjust here, not in the splat file, to keep tent.position values stable across re-captures.';

comment on column events.status is
  'draft = invisible to public; published = visible; archived = visible by URL only, not in lists.';

comment on column tents.position is
  'World coordinates {x, y, z} (meters) in the splat scene. CHECK constraint enforces the shape; values themselves are admin-placed via the 3D Place Mode.';

comment on column tent_photos.consent_recorded_at is
  'Timestamp when the exhibitor consented to public display. NULL means no consent yet recorded (per D-008, consent is collected outside this app, but the timestamp is required to be set explicitly when uploading).';

comment on column profiles.role is
  'Global role. admin = manage all events + users; editor = needs explicit event_admins grant per event.';

comment on column event_admins.role_in_event is
  'Per-event capability. owner = manage event metadata + duplicate + admin grants; editor = manage tents + categories + photos.';
