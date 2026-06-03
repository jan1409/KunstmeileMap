import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type TentPhoto } from '../lib/supabase';
import { photoPublicUrl, uploadTentPhotos } from '../lib/photos';
import { rotateImageBlob90CW } from '../lib/imageRotate';
import { useIsMobile } from '../hooks/useIsMobile';

const isImageFile = (f: File) => f.type.startsWith('image/');

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
  const isMobile = useIsMobile();
  const [photos, setPhotos] = useState<TentPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

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

  async function runUpload(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const { error: err } = await uploadTentPhotos(
      files,
      eventId,
      tentId,
      photos.length,
    );
    if (err) setError(err);
    setBusy(false);
    setReloadTick((n) => n + 1);
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    await runUpload(Array.from(e.target.files ?? []).filter(isImageFile));
    e.target.value = '';
  }

  // Desktop-only drag-and-drop. On mobile/touch (md breakpoint) no handlers are
  // attached, so the area behaves exactly as before. onDragOver must
  // preventDefault for the browser to allow the drop.
  const dropProps = isMobile
    ? {}
    : {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setDragActive(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          e.preventDefault();
          setDragActive(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragActive(false);
          void runUpload(Array.from(e.dataTransfer.files).filter(isImageFile));
        },
      };

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
      // Fetch the current stored file. cache: 'no-store' guards against the
      // browser/CDN serving us a stale copy that would just round-trip the
      // same rotation.
      const response = await fetch(photoPublicUrl(p.storage_path), {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Failed to download photo (${response.status})`);
      }
      const blob = await response.blob();
      const rotated = await rotateImageBlob90CW(blob);

      // Upload to a NEW path (fresh UUID) and update the tent_photos row to
      // point at it. Upserting at the same path turned out to be unreliable
      // because edge caches kept serving the pre-rotation copy; rotating the
      // URL itself sidesteps every caching layer.
      const newPath = `${eventId}/${tentId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('tent-photos')
        .upload(newPath, rotated, { contentType: 'image/jpeg' });
      if (upErr) throw new Error(upErr.message);

      const { error: updErr } = await supabase
        .from('tent_photos')
        .update({ storage_path: newPath })
        .eq('id', p.id);
      if (updErr) {
        // Roll back the just-uploaded orphan to avoid leaving litter.
        await supabase.storage.from('tent-photos').remove([newPath]);
        throw new Error(updErr.message);
      }

      // Best-effort: delete the now-unreferenced old file. If it fails, we
      // accept a small orphan over a broken UI state.
      await supabase.storage.from('tent-photos').remove([p.storage_path]);

      setReloadTick((n) => n + 1);
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
      <div
        {...dropProps}
        className={`rounded ${
          !isMobile && dragActive
            ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-neutral-900'
            : ''
        }`}
      >
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => {
          const url = photoPublicUrl(p.storage_path, {
            width: ADMIN_GRID_THUMB_WIDTH,
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
      {!isMobile && (
        <p className="mt-2 text-xs text-white/40">
          {dragActive
            ? t('admin.photo_upload.drop_active')
            : t('admin.photo_upload.drop_hint')}
        </p>
      )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
