-- Per-event photo-viewer quality. false (default) => the public full-screen
-- lightbox loads a compressed, fast preview via Supabase Image Transformations;
-- true => it loads the full-size original. Originals are ALWAYS kept in storage
-- and are always used at full resolution by ZIP export/download regardless of
-- this flag.
alter table events
  add column lightbox_full_size boolean not null default false;
