-- Add an optional, admin-chosen marker color to categories.
-- NULL keeps today's behaviour: the marker color is auto-derived from the
-- category slug via a hash into a fixed palette (see src/lib/map.ts).
alter table categories add column color text;

comment on column categories.color is
  'Optional hex marker color (#rrggbb). NULL = auto color from slug hash.';
