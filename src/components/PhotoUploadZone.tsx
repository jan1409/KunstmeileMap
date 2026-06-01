import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type TentPhoto } from '../lib/supabase';
import { photoPublicUrl } from '../lib/photos';
import { rotateImageBlob90CW } from '../lib/imageRotate';

/**
 * Width for the 3-column admin photo grid. Each cell renders at ~218px wide
 * inside max-w-2xl; doubling for retina lands at ~500px with a buffer.
 */
const ADMIN_GRID_THUMB_WIDTH = 600;

interface Props {
  eventId: string;
  tentId: string;
}

export function PhotoUploadZone({ eventId, tentId }: Props) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<TentPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // Bumped per-photo when a rotation overwrites the underlying file; appended
  // to the rendered URL as ?v= to bust the browser cache (storage path is
  // unchanged after an upsert, so the URL would otherwise stay stale).
  const [rotationBumps, setRotationBumps] = useState<Record<string, number>>(
    {},
  );
  const [rotatingId, setRotatingId] = useState<string | null>(null);

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

  async function rotate(p: TentPhoto) {
    if (rotatingId) return;
    setRotatingId(p.id);
    setError(null);
    try {
      // Fetch the original (no transform) so we rotate the actual stored
      // bytes, not the resized thumbnail.
      const response = await fetch(photoPublicUrl(p.storage_path));
      if (!response.ok) {
        throw new Error(`Failed to download original (${response.status})`);
      }
      const blob = await response.blob();
      const rotated = await rotateImageBlob90CW(blob);
      const { error: upErr } = await supabase.storage
        .from('tent-photos')
        .upload(p.storage_path, rotated, {
          upsert: true,
          contentType: 'image/jpeg',
        });
      if (upErr) throw new Error(upErr.message);
      // Force a fresh fetch of the now-overwritten image.
      setRotationBumps((prev) => ({
        ...prev,
        [p.id]: (prev[p.id] ?? 0) + 1,
      }));
    } catch (err) {
      setError(
        t('admin.photo_upload.rotate_error', {
          message: err instanceof Error ? err.message : 'unknown',
        }),
      );
    } finally {
      setRotatingId(null);
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{t('admin.photo_upload.heading')}</h3>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => {
          const url = photoPublicUrl(p.storage_path, {
            width: ADMIN_GRID_THUMB_WIDTH,
            cacheKey: rotationBumps[p.id],
          });
          const isRotating = rotatingId === p.id;
          return (
            <div key={p.id} className="relative">
              <img
                src={url}
                alt={t('admin.photo_upload.alt')}
                className={`aspect-square w-full rounded object-cover ${
                  isRotating ? 'opacity-50' : ''
                }`}
              />
              <button
                type="button"
                aria-label={t('admin.photo_upload.rotate')}
                onClick={() => rotate(p)}
                disabled={rotatingId !== null}
                className="absolute left-1 top-1 rounded bg-black/70 px-1 text-xs disabled:opacity-50"
              >
                ↻
              </button>
              <button
                type="button"
                aria-label={t('admin.photo_upload.remove')}
                onClick={() => remove(p)}
                disabled={rotatingId !== null}
                className="absolute right-1 top-1 rounded bg-black/70 px-1 text-xs disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <label className="mt-2 block text-xs text-white/60">
        <span className="block">{t('admin.photo_upload.add_photos')}</span>
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
