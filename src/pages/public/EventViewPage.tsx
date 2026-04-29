import { useState } from 'react';
import { SplatViewer } from '../../components/SplatViewer';
import { SidePanel } from '../../components/SidePanel';
import type { MarkerData } from '../../lib/three/MarkerLayer';
import type { Tent, Category } from '../../lib/supabase';

const PLACEHOLDER_SPLAT = '/OldTrainStation.splat';

const TEST_MARKERS: MarkerData[] = [
  { id: 't1', position: { x: 0, y: 0, z: 0 }, category_icon: '🌳' },
  { id: 't2', position: { x: 2, y: 0, z: 1 }, category_icon: '🏺' },
  { id: 't3', position: { x: -2, y: 0, z: -1 }, category_icon: '🎨' },
];

const TEST_CATEGORIES: Record<string, Category> = {
  c1: {
    id: 'c1',
    event_id: 'e1',
    slug: 'holzkunst',
    name_de: 'Holzkunst',
    name_en: 'Woodcraft',
    icon: '🌳',
    display_order: 1,
    created_at: new Date().toISOString(),
  },
  c2: {
    id: 'c2',
    event_id: 'e1',
    slug: 'keramik',
    name_de: 'Keramik',
    name_en: 'Ceramics',
    icon: '🏺',
    display_order: 2,
    created_at: new Date().toISOString(),
  },
  c3: {
    id: 'c3',
    event_id: 'e1',
    slug: 'malerei',
    name_de: 'Malerei',
    name_en: 'Painting',
    icon: '🎨',
    display_order: 3,
    created_at: new Date().toISOString(),
  },
};

function makeTestTent(
  id: string,
  name: string,
  description_de: string,
  address: string,
  category_id: string,
  position: { x: number; y: number; z: number },
  links: { website?: string; instagram?: string; facebook?: string },
): Tent {
  const now = new Date().toISOString();
  return {
    id,
    slug: id,
    event_id: 'e1',
    name,
    description_de,
    description_en: null,
    address,
    category_id,
    position,
    website_url: links.website ?? null,
    instagram_url: links.instagram ?? null,
    facebook_url: links.facebook ?? null,
    email_public: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
  };
}

const TEST_TENTS: Record<string, Tent> = {
  t1: makeTestTent(
    't1',
    'Alice Holzkunst',
    'Handgemachte Holzfiguren aus Eiche und Birke.',
    'Mühlenweg 1',
    'c1',
    { x: 0, y: 0, z: 0 },
    { website: 'https://example.com', instagram: 'https://instagram.com/alice' },
  ),
  t2: makeTestTent(
    't2',
    "Bob's Töpferstube",
    'Geschirr und Vasen, alle handgedreht.',
    'Mühlenweg 3',
    'c2',
    { x: 2, y: 0, z: 1 },
    { facebook: 'https://facebook.com/bob' },
  ),
  t3: makeTestTent(
    't3',
    'Carla Malt',
    'Aquarelle und Öl. Nordseelandschaften.',
    'Mühlenweg 5',
    'c3',
    { x: -2, y: 0, z: -1 },
    { website: 'https://carla.example.com' },
  ),
};

export default function EventViewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tent = selectedId ? TEST_TENTS[selectedId] ?? null : null;
  const category = tent?.category_id ? TEST_CATEGORIES[tent.category_id] ?? null : null;

  return (
    <main className="h-screen w-screen">
      <SplatViewer
        splatUrl={PLACEHOLDER_SPLAT}
        markers={TEST_MARKERS}
        selectedTentId={selectedId}
        onMarkerClick={(id) => setSelectedId((cur) => (cur === id ? null : id))}
      />
      <SidePanel
        tent={tent}
        category={category}
        photoUrls={[]}
        onClose={() => setSelectedId(null)}
      />
    </main>
  );
}
