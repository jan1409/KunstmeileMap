import { supabase } from './supabase';

const BUCKET = 'tent-photos';

export interface PhotoUrlOptions {
  /** Target width in CSS pixels. Supabase scales the source down to this. */
  width?: number;
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
  const transform: { width?: number; quality?: number; resize?: 'contain' } = {};
  if (options.width != null) transform.width = options.width;
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
