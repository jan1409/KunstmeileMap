// JSON responses + error mapping shared by the REST API Edge Functions.
import { CORS_HEADERS } from './cors.ts';

/** A thrown error that carries the HTTP status + machine-readable code. */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

/** JSON response with CORS headers. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** Convert any thrown value into a JSON error response. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ error: err.code, message: err.message }, err.status);
  }
  const message = err instanceof Error ? err.message : 'internal_error';
  return json({ error: 'internal_error', message }, 500);
}

interface PgLikeError {
  code?: string;
  message?: string;
  details?: string;
}

/**
 * Map a Postgres/PostgREST error to an HttpError. RLS denials surface as 42501
 * (insufficient privilege) → 403; duplicate slug → 409; FK/check violations →
 * 400. Anything else is a 500.
 */
export function pgError(error: PgLikeError): HttpError {
  switch (error.code) {
    case '23505':
      return new HttpError(409, 'conflict', error.message ?? 'Duplicate value.');
    case '42501':
      return new HttpError(403, 'forbidden', 'You do not have permission for this operation.');
    case '23503':
      return new HttpError(400, 'invalid_reference', error.message ?? 'Referenced row does not exist.');
    case '23514':
      return new HttpError(400, 'check_violation', error.message ?? 'A value is out of range.');
    case '22P02':
    case '22007':
      return new HttpError(400, 'invalid_input', error.message ?? 'Invalid input value.');
    default:
      return new HttpError(500, 'database_error', error.message ?? 'Database error.');
  }
}

/** Map a Supabase Storage error to an HttpError (RLS denial → 403). */
export function storageError(err: { message?: string }): HttpError {
  const msg = err.message ?? 'storage error';
  if (/row-level security|unauthorized|forbidden|not authorized/i.test(msg)) {
    return new HttpError(403, 'forbidden', 'You do not have permission to write this file.');
  }
  return new HttpError(500, 'storage_error', msg);
}

/** Parse a JSON request body, throwing a clean 400 on malformed input. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
}
