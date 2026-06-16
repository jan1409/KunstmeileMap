// Small CRUD helpers shared by the events/tents functions.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HttpError, pgError } from './http.ts';

/**
 * Confirm a row is visible to the caller, else 404. Used before update/delete so
 * we can distinguish "doesn't exist / not visible" (404) from "visible but the
 * write was blocked by RLS" (403 — detected via an empty returning set).
 */
export async function ensureExists(
  client: SupabaseClient,
  table: string,
  id: string,
  label: string,
): Promise<void> {
  const { data, error } = await client.from(table).select('id').eq('id', id).maybeSingle();
  if (error) throw pgError(error);
  if (!data) throw new HttpError(404, 'not_found', `${label} not found.`);
}
