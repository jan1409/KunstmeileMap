-- Demo data for documentation screenshots (and local exploration).
-- Creates a small, realistic published event "Kunstmeile Demo" so the public
-- map and admin screens look real and reproducible.
--
-- NOT for production. Run against a local or throwaway Supabase project, e.g.:
--   psql "$DATABASE_URL" -f supabase/seed-demo.sql
--   -- or paste into the Supabase SQL editor
--
-- Idempotent: re-running deletes and recreates the demo event (cascades to its
-- categories, tents, tent_categories and tent_photos).
--
-- Notes:
--  * Admin screenshots are captured by logging in as an existing GLOBAL admin
--    (RLS lets a global admin manage any event), so no auth user is seeded here.
--  * Photos are not seeded (storage files can't be created from SQL). For the
--    photo-grid / lightbox screenshots, upload a couple of images to any demo
--    tent via the admin UI first.

begin;

delete from events where slug = 'kunstmeile-demo';

with ev as (
  insert into events (
    slug, title_de, title_en, year, status, is_featured,
    default_lat, default_lng, default_zoom, lightbox_full_size,
    venue_name, venue_address, starts_at, ends_at
  )
  values (
    'kunstmeile-demo', 'Kunstmeile Demo', 'Kunstmeile Demo', 2026, 'published', false,
    53.2771, 9.5090, 18, true,
    'Alter Bahnhof', 'Bahnhofstraße 1, 21423 Winsen (Luhe)',
    '2026-05-29', '2026-05-31'
  )
  returning id
),
cats as (
  insert into categories (event_id, slug, name_de, name_en, icon, display_order)
  select ev.id, c.slug, c.de, c.en, c.icon, c.ord
  from ev, (values
    ('art',     'Kunst',     'Art',     '🎨',  1),
    ('food',    'Essen',     'Food',    '🍔',  2),
    ('drinks',  'Getränke',  'Drinks',  '🍺',  3),
    ('music',   'Musik',     'Music',   '🎵',  4),
    ('parking', 'Parken',    'Parking', '🅿️', 5)
  ) as c(slug, de, en, icon, ord)
  returning id, slug, event_id
),
tnt as (
  insert into tents (
    event_id, slug, name, display_number, contact_person,
    description_de, description_en, address,
    website_url, email_public, marker_icon, lat, lng
  )
  select ev.id, t.slug, t.name, t.num, t.contact,
         t.de, t.en, t.addr, t.web, t.email, t.icon, t.lat, t.lng
  from ev, (values
    ('atelier-mueller', 'Atelier Müller',      1, 'Anna Müller',
       'Malerei und Aquarelle aus der Region.', 'Paintings and watercolours from the region.',
       'Bahnhofstraße 1', 'https://example.com', 'info@example.com', NULL, 53.27725, 9.50880),
    ('keramik-studio',  'Keramik Studio',      2, 'Bernd Schulz',
       'Handgetöpferte Keramik und Skulpturen.', 'Hand-thrown ceramics and sculptures.',
       'Bahnhofstraße 3', NULL, NULL, NULL, 53.27700, 9.50930),
    ('foto-galerie',    'Foto Galerie',        3, 'Carla Weber',
       'Fotografie und Lichtkunst.', 'Photography and light art.',
       'Marktplatz 2', NULL, NULL, NULL, 53.27680, 9.50990),
    ('food-truck',      'Food Truck',          4, 'Deniz Yilmaz',
       'Burger und vegetarische Snacks.', 'Burgers and vegetarian snacks.',
       'Marktplatz', NULL, NULL, 'burger', 53.27750, 9.50980),
    ('craft-beer',      'Craft Beer Stand',    5, 'Erik Jansen',
       'Regionale Biere vom Fass.', 'Regional draught beers.',
       'Marktplatz', NULL, NULL, 'beer', 53.27765, 9.50935),
    ('buehne',          'Bühne',               6, 'Festival-Team',
       'Live-Musik den ganzen Tag.', 'Live music all day.',
       'Bahnhofsvorplatz', NULL, NULL, NULL, 53.27710, 9.50845),
    ('parkplatz-nord',  'Parkplatz Nord',      7, NULL,
       'Besucherparkplatz im Norden.', 'Visitor parking to the north.',
       'Nordstraße', NULL, NULL, 'parking', 53.27810, 9.50900)
  ) as t(slug, name, num, contact, de, en, addr, web, email, icon, lat, lng)
  returning id, slug
)
insert into tent_categories (tent_id, category_id)
select tnt.id, cats.id
from tnt
join (values
  ('atelier-mueller', 'art'),
  ('keramik-studio',  'art'),
  ('foto-galerie',    'art'),
  ('food-truck',      'food'),
  ('craft-beer',      'drinks'),
  ('buehne',          'music'),
  ('parkplatz-nord',  'parking')
) as m(tent_slug, cat_slug) on m.tent_slug = tnt.slug
join cats on cats.slug = m.cat_slug;

commit;
