import { useState } from 'react';
import { SplatViewer } from '../../components/SplatViewer';
import type { MarkerData } from '../../lib/three/MarkerLayer';

// Placeholder splat for development before A2-T13 wires up event.splat_url.
// Local file in public/ (gitignored — see .gitignore).
const PLACEHOLDER_SPLAT = '/OldTrainStation.splat';

// Static test markers until A2-T13 fetches real ones from Supabase.
const TEST_MARKERS: MarkerData[] = [
  { id: 't1', position: { x: 0, y: 0, z: 0 }, category_icon: '🌳' },
  { id: 't2', position: { x: 2, y: 0, z: 1 }, category_icon: '🏺' },
  { id: 't3', position: { x: -2, y: 0, z: -1 }, category_icon: '🎨' },
];

export default function EventViewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <main className="h-screen w-screen">
      <SplatViewer
        splatUrl={PLACEHOLDER_SPLAT}
        markers={TEST_MARKERS}
        selectedTentId={selectedId}
        onMarkerClick={(id) => setSelectedId((cur) => (cur === id ? null : id))}
      />
      {selectedId && (
        <div className="absolute right-4 top-4 rounded bg-black/70 px-3 py-1 text-sm text-white">
          Selected: {selectedId}
        </div>
      )}
    </main>
  );
}
