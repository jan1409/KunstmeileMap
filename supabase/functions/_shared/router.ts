// Minimal path routing for Edge Functions. Supabase invokes a function at
// /functions/v1/<name>/<rest...>; inside the function the leading segments may
// or may not be present depending on the runtime, so we slice everything after
// the function name. Returns [] for the collection root, ['<id>'] for an item.

export function subPath(req: Request, fnName: string): string[] {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const idx = parts.indexOf(fnName);
  return idx === -1 ? [] : parts.slice(idx + 1);
}
