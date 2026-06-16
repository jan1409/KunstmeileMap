// Storage helpers for tent photos. The bucket is public-read; objects live at
// <event_id>/<tent_id>/<uuid>.<ext> (same convention as src/lib/photos.ts).

export const BUCKET = 'tent-photos';

/** Lowercased file extension from a name; falls back when absent/implausible. */
export function extFromName(name: string, fallback = 'jpg'): string {
  const ext = name.includes('.') ? name.split('.').pop() : undefined;
  return ext && ext.length >= 1 && ext.length <= 5 ? ext.toLowerCase() : fallback;
}

/** Build a unique storage object path for a new photo. */
export function buildStoragePath(eventId: string, tentId: string, ext: string): string {
  return `${eventId}/${tentId}/${crypto.randomUUID()}.${ext}`;
}

export interface UrlVariants {
  /** Original-resolution public URL. */
  url: string;
  /** ~640px wide, aspect-preserving (gallery thumbnail). */
  thumb_url: string;
  /** Long edge capped at 1600px, q72 (web-optimized full view). */
  full_url: string;
}

/** Build the public + transformed URLs for a stored object. */
export function photoUrls(baseUrl: string, path: string): UrlVariants {
  const root = `${baseUrl}/storage/v1`;
  const enc = path.split('/').map(encodeURIComponent).join('/');
  return {
    url: `${root}/object/public/${BUCKET}/${enc}`,
    thumb_url: `${root}/render/image/public/${BUCKET}/${enc}?width=640&resize=contain`,
    full_url: `${root}/render/image/public/${BUCKET}/${enc}?width=1600&height=1600&quality=72&resize=contain`,
  };
}
