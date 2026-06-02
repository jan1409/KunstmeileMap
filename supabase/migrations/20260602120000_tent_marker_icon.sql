-- Adds an optional 'marker_icon' to tents. When set, the map marker renders a
-- symbol (e.g. food type or a parking 'P') instead of the display number. The
-- value is a stable key from the front-end marker-icon registry
-- (src/lib/markerIcons.ts); NULL means "no special icon, show the number".
alter table tents add column marker_icon text;
