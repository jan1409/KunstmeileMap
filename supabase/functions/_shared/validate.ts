// Request-body schemas (zod) for the REST API. Mirrors the field rules used by
// the in-app forms (TentEditForm) so the API and UI accept the same data.
import { z } from 'https://esm.sh/zod@4';
import { HttpError } from './http.ts';

/** Validate `data` against `schema`, throwing a clean 400 on failure. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new HttpError(400, 'validation_error', detail);
  }
  return result.data;
}

const SLUG = z.string().regex(/^[a-z0-9-]+$/, 'must be lowercase letters, digits, dashes');
const URL_OR_BLANK = z.url().optional().or(z.literal(''));
const EMAIL_OR_BLANK = z.email().optional().or(z.literal(''));

export const EventCreate = z.object({
  slug: SLUG,
  title_de: z.string().min(1),
  year: z.number().int(),
  title_en: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  is_featured: z.boolean().optional(),
  default_lat: z.number().min(-90).max(90).optional(),
  default_lng: z.number().min(-180).max(180).optional(),
  default_zoom: z.number().int().min(1).max(22).optional(),
});

export const EventUpdate = EventCreate.partial();

export const TentCreate = z.object({
  event_id: z.string().uuid(),
  slug: SLUG,
  name: z.string().min(1),
  description_de: z.string().optional(),
  description_en: z.string().optional(),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  marker_icon: z.string().optional(),
  website_url: URL_OR_BLANK,
  instagram_url: URL_OR_BLANK,
  facebook_url: URL_OR_BLANK,
  email_public: EMAIL_OR_BLANK,
  display_number: z.number().int().positive().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  category_ids: z.array(z.string().uuid()).optional(),
});

export const TentUpdate = TentCreate.omit({ event_id: true }).partial();

export const PhotoUpdate = z.object({
  caption_de: z.string().optional(),
  caption_en: z.string().optional(),
  display_order: z.number().int().min(0).optional(),
});
