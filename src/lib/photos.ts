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
  const hasTransform = options.width != null || options.quality != null;
  const arg = hasTransform
    ? { transform: { width: options.width, quality: options.quality } }
    : undefined;
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath, arg).data
    .publicUrl;
}
