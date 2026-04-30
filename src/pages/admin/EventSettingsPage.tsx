import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';

type Status = 'draft' | 'published' | 'archived';

export default function EventSettingsPage() {
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const [titleDe, setTitleDe] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [splatUrl, setSplatUrl] = useState('');
  const [status, setStatus] = useState<Status>('draft');
  const [isFeatured, setIsFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds form state once when the loaded event arrives; subsequent edits are local. React 19's preferred alternative (re-mount via key) would also force-discard in-flight edits on re-fetch, so it's a worse fit here.
    setTitleDe(event.title_de);
    setTitleEn(event.title_en ?? '');
    setSplatUrl(event.splat_url ?? '');
    setStatus(event.status as Status);
    setIsFeatured(event.is_featured);
  }, [event]);

  async function save() {
    if (!event) return;
    setBusy(true);
    setError(null);
    setSavedAt(null);
    const { error: err } = await supabase
      .from('events')
      .update({
        title_de: titleDe,
        title_en: titleEn || null,
        splat_url: splatUrl || null,
        status,
        is_featured: isFeatured,
      })
      .eq('id', event.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSavedAt(Date.now());
  }

  if (!event) return null;

  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold">Settings — {event.title_de}</h1>

      <label className="block text-xs">
        <span className="block text-white/60">Title (DE)</span>
        <input
          value={titleDe}
          onChange={(e) => setTitleDe(e.target.value)}
          className="input mt-1"
        />
      </label>

      <label className="block text-xs">
        <span className="block text-white/60">Title (EN)</span>
        <input
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          className="input mt-1"
        />
      </label>

      <label className="block text-xs">
        <span className="block text-white/60">Splat URL</span>
        <input
          value={splatUrl}
          onChange={(e) => setSplatUrl(e.target.value)}
          className="input mt-1"
        />
      </label>

      <label className="block text-xs">
        <span className="block text-white/60">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="input mt-1"
        >
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
        />
        Featured (homepage default)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-white/20 px-4 py-2 disabled:opacity-50"
        >
          {busy ? '…' : 'Save'}
        </button>
        {savedAt && !error && (
          <span className="text-xs text-green-400">Saved.</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
