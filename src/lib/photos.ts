import { supabase } from './supabase';

const BUCKET = 'tent-photos';

export interface PhotoUrlOptions {
  /** Target width in CSS pixels. Supabase scales the source down to this. */
  width?: number;
  /**
   * Target height in CSS pixels. Combined with `width` and the `contain` resize
   * mode, the image is fit within a width×height box — i.e. setting both to the
   * same value caps the *long edge* regardless of portrait/landscape orientation
   * (used by the web-optimized snapshot export).
   */
  height?: number;
  /** JPEG quality, 1-100. Defaults to Supabase's default (~80). */
  quality?: number;
  /**
   * Cache-busting token appended to the URL as `&v=…`. Bump this whenever the
   * underlying file at the same storage path is overwritten (e.g. after a
   * rotation) to force the browser to re-fetch.
   */
  cacheKey?: string | number;
}

/**
 * Build a public URL for a tent photo. When `width` and/or `quality` are set,
 * Supabase Image Transformations serve a resized/recompressed variant — much
 * faster to load than the original. Pass no options to get the original (used
 * for downloads and rotation source). Requires the Supabase Pro plan.
 *
 * IMPORTANT: we always pass `resize: 'contain'` when transforming, because
 * Supabase's default mode is `cover` — which crops projecting parts to fill
 * the target box. With only `width` specified, that cropping produced
 * unintended narrow slices of portrait photos. `contain` resizes the image to
 * fit within the requested width while preserving the original aspect ratio.
 */
export function photoPublicUrl(
  storagePath: string,
  options: PhotoUrlOptions = {},
): string {
  // Build the transform object only with defined keys — passing
  // `quality: undefined` can cause Supabase to reject the transform and
  // serve a broken response.
  const transform: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: 'contain';
  } = {};
  if (options.width != null) transform.width = options.width;
  if (options.height != null) transform.height = options.height;
  if (options.quality != null) transform.quality = options.quality;
  const hasTransform = Object.keys(transform).length > 0;
  if (hasTransform) transform.resize = 'contain';
  const url = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath, hasTransform ? { transform } : undefined)
    .data.publicUrl;
  if (options.cacheKey == null) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(options.cacheKey))}`;
}

/**
 * Upload image files to a tent: one `tent-photos` storage object per file plus a
 * `tent_photos` row, ordered from `startOrder`. Shared by the admin file picker
 * and the desktop drag-and-drop handler. A failed file is skipped (its message
 * kept as the returned `error`) so the rest still upload — matching the prior
 * inline behavior.
 */
export async function uploadTentPhotos(
  files: File[],
  eventId: string,
  tentId: string,
  startOrder: number,
): Promise<{ uploaded: number; error: string | null }> {
  let uploaded = 0;
  let error: string | null = null;
  for (const f of files) {
    const ext = f.name.split('.').pop() ?? 'jpg';
    const path = `${eventId}/${tentId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, f);
    if (upErr) {
      error = upErr.message;
      continue;
    }
    await supabase.from('tent_photos').insert({
      tent_id: tentId,
      storage_path: path,
      display_order: startOrder + uploaded,
    });
    uploaded += 1;
  }
  return { uploaded, error };
}
