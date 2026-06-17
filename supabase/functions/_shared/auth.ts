// Auth helpers: build a caller-scoped Supabase client (RLS active) from the
// request's Bearer token, exactly like invite-user. The whole API delegates
// authorization to RLS — we never use the service-role key here.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HttpError } from './http.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, 'config_error', `Missing ${name}.`);
  return value;
}

/** Project URL — used to build public Storage URLs in responses. */
export function supabaseUrl(): string {
  return env('SUPABASE_URL');
}

/**
 * A Supabase client that forwards the caller's JWT, so every query runs under
 * that user's RLS policies. Throws 401 when no Bearer token is present.
 */
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'unauthenticated', 'Missing or malformed Authorization header.');
  }
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Require a real authenticated user (not just a valid anon key, which also
 * satisfies verify_jwt). Returns the user id.
 */
export async function requireUser(client: SupabaseClient): Promise<{ id: string }> {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new HttpError(401, 'unauthenticated', error?.message ?? 'Not signed in.');
  }
  return { id: data.user.id };
}
