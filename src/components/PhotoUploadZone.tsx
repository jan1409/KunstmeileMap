import { useEffect, useState } from 'react';
import { supabase, type TentPhoto } from '../lib/supabase';

interface Props {
  eventId: string;
  tentId: string;
}

export function PhotoUploadZone({ eventId, tentId }: Props) {
  const [photos, setPhotos] = useState<TentPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('tent_photos')
      .select('*')
      .eq('tent_id', tentId)
      .order('display_order')
      .then(({ data }) => {
        if (cancelled) return;
        setPhotos(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [tentId, reloadTick]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    let nextOrder = photos.length;
    for (const f of files) {
      const ext = f.name.split('.').pop() ?? 'jpg';
      const path = `${eventId}/${tentId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('tent-photos')
        .upload(path, f);
      if (upErr) {
        setError(upErr.message);
        continue;
      }
      await supabase.from('tent_photos').insert({
        tent_id: tentId,
        storage_path: path,
        display_order: nextOrder,
      });
      nextOrder += 1;
    }
    setBusy(false);
    e.target.value = '';
    setReloadTick((n) => n + 1);
  }

  async function remove(p: TentPhoto) {
    await supabase.storage.from('tent-photos').remove([p.storage_path]);
    await supabase.from('tent_photos').delete().eq('id', p.id);
    setReloadTick((n) => n + 1);
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Photos</h3>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => {
          const url = supabase.storage
            .from('tent-photos')
            .getPublicUrl(p.storage_path).data.publicUrl;
          return (
            <div key={p.id} className="relative">
              <img
                src={url}
                alt="Tent photo"
                className="aspect-square w-full rounded object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => remove(p)}
                className="absolute right-1 top-1 rounded bg-black/70 px-1 text-xs"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <label className="mt-2 block text-xs text-white/60">
        <span className="block">Add photos</span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={onChange}
          className="mt-1"
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
