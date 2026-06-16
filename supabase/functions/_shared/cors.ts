// Shared CORS handling for the public REST API Edge Functions (events, tents,
// photos). Mirrors the header set used by invite-user so supabase-js's
// functions.invoke() and browser fetch() both pass preflight.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
} as const;

/** Standard 204 response for an OPTIONS preflight request. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
