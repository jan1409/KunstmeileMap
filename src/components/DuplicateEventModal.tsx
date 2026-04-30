import { useState } from 'react';
import { supabase, type Event } from '../lib/supabase';

interface Props {
  source: Event;
  onClose: () => void;
  onCreated: (newEventId: string) => void;
}

export function DuplicateEventModal({ source, onClose, onCreated }: Props) {
  const [slug, setSlug] = useState(`${source.slug}-copy`);
  const [titleDe, setTitleDe] = useState(`${source.title_de} (Kopie)`);
  const [year, setYear] = useState(source.year + 1);
  const [cloneCats, setCloneCats] = useState(true);
  const [cloneTents, setCloneTents] = useState(true);
  const [clonePos, setClonePos] = useState(true);
  const [cloneSplat, setCloneSplat] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('duplicate_event', {
      source_event_id: source.id,
      new_slug: slug,
      new_title_de: titleDe,
      new_year: year,
      clone_categories: cloneCats,
      clone_tents: cloneTents,
      clone_tent_positions: cloneTents && clonePos,
      clone_splat_url: cloneSplat,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onCreated(data as string);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-event-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded bg-neutral-900 p-6">
        <h2 id="duplicate-event-title" className="mb-4 text-lg font-semibold">
          Duplicate "{source.title_de}"
        </h2>
        <label className="block text-xs">
          <span className="block text-white/60">Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="input mt-1"
          />
        </label>
        <label className="mt-2 block text-xs">
          <span className="block text-white/60">Title (DE)</span>
          <input
            value={titleDe}
            onChange={(e) => setTitleDe(e.target.value)}
            className="input mt-1"
          />
        </label>
        <label className="mt-2 block text-xs">
          <span className="block text-white/60">Year</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input mt-1"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cloneCats}
            onChange={(e) => setCloneCats(e.target.checked)}
          />
          Clone categories
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cloneTents}
            onChange={(e) => setCloneTents(e.target.checked)}
          />
          Clone tents
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={clonePos}
            onChange={(e) => setClonePos(e.target.checked)}
            disabled={!cloneTents}
          />
          Clone tent positions
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cloneSplat}
            onChange={(e) => setCloneSplat(e.target.checked)}
          />
          Clone splat URL
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white/10 px-3 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded bg-white/20 px-3 py-1 disabled:opacity-50"
          >
            {busy ? '…' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  );
}
