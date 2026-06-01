import { supabase } from './supabase';

const BUCKET = 'tent-photos';

export interface PhotoUrlOptions {
  /** Target width in CSS pixels. Supabase scales the source down to this. */
  width?: number;
  /** JPEG quality, 1-100. Defaults to Supabase's default (~80). */
  quality?: number;
}

/**
 * Build a public URL for a tent photo. When `width` and/or `quality` are set,
 * Supabase Image Transformations serve a resized/recompressed variant — much
 * faster to load than the original. Pass no options to get the original (used
 * for downloads and rotation source). Requires the Supabase Pro plan.
 */
export function photoPublicUrl(
  storagePath: string,
  options: PhotoUrlOptions = {},
): string {
  // Build the transform object only with defined keys — passing
  // `quality: undefined` can cause Supabase to reject the transform and
  // serve a broken response.
  const transform: { width?: number; quality?: number } = {};
  if (options.width != null) transform.width = options.width;
  if (options.quality != null) transform.quality = options.quality;
  const hasTransform = Object.keys(transform).length > 0;
  return supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath, hasTransform ? { transform } : undefined)
    .data.publicUrl;
}
