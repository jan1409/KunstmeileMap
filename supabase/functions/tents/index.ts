// Edge Function: tents — REST CRUD for an event's tents.
//
//   GET    /tents?event_id={id}   list tents (optionally filtered to an event)
//   GET    /tents/{id}            one tent
//   POST   /tents                 create (editor/owner/admin); body has event_id
//   PATCH  /tents/{id}            update (contributor/editor/owner/admin)
//   DELETE /tents/{id}            delete (editor/owner/admin)
//
// `category_ids` (optional) sets the tent's categories via tent_categories.
// Authorization is delegated to Postgres RLS via the caller's JWT.
import { preflight } from '../_shared/cors.ts';
import { json, errorResponse, HttpError, pgError, readJson } from '../_shared/http.ts';
import { userClient, requireUser } from '../_shared/auth.ts';
import { subPath } from '../_shared/router.ts';
import { ensureExists } from '../_shared/crud.ts';
import { parseBody, TentCreate, TentUpdate } from '../_shared/validate.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BUCKET } from '../_shared/storage.ts';

/** Replace a tent's category links (delete-all-then-insert, like the admin UI). */
async function replaceCategories(
  client: SupabaseClient,
  tentId: string,
  categoryIds: string[],
): Promise<void> {
  const { error: delErr } = await client.from('tent_categories').delete().eq('tent_id', tentId);
  if (delErr) throw pgError(delErr);
  if (categoryIds.length === 0) return;
  const rows = categoryIds.map((category_id) => ({ tent_id: tentId, category_id }));
  const { error: insErr } = await client.from('tent_categories').insert(rows);
  if (insErr) throw pgError(insErr);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return preflight();

    const client = userClient(req);
    await requireUser(client);
    const [id] = subPath(req, 'tents');

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('tents')
          .select('*, tent_categories(category_id)')
          .eq('id', id)
          .maybeSingle();
        if (error) throw pgError(error);
        if (!data) throw new HttpError(404, 'not_found', 'Tent not found.');
        return json(data);
      }
      const eventId = new URL(req.url).searchParams.get('event_id');
      let query = client
        .from('tents')
        .select('*, tent_categories(category_id)')
        .order('display_number', { ascending: true, nullsFirst: false });
      if (eventId) query = query.eq('event_id', eventId);
      const { data, error } = await query;
      if (error) throw pgError(error);
      return json({ tents: data ?? [] });
    }

    if (req.method === 'POST') {
      if (id) throw new HttpError(405, 'method_not_allowed', 'POST is for the collection.');
      const { category_ids, ...fields } = parseBody(TentCreate, await readJson(req));
      const { data, error } = await client.from('tents').insert(fields).select().single();
      if (error) throw pgError(error);
      if (category_ids) await replaceCategories(client, data.id, category_ids);
      return json(data, 201);
    }

    if (req.method === 'PATCH') {
      if (!id) throw new HttpError(400, 'missing_id', 'Tent id required in the path.');
      const { category_ids, ...fields } = parseBody(TentUpdate, await readJson(req));
      await ensureExists(client, 'tents', id, 'Tent');

      let updated: Record<string, unknown> | null = null;
      if (Object.keys(fields).length > 0) {
        const { data, error } = await client.from('tents').update(fields).eq('id', id).select();
        if (error) throw pgError(error);
        if (!data || data.length === 0) {
          throw new HttpError(403, 'forbidden', 'Not allowed to update this tent.');
        }
        updated = data[0];
      }
      if (category_ids) await replaceCategories(client, id, category_ids);

      if (!updated) {
        const { data } = await client.from('tents').select('*').eq('id', id).maybeSingle();
        updated = data;
      }
      return json(updated);
    }

    if (req.method === 'DELETE') {
      if (!id) throw new HttpError(400, 'missing_id', 'Tent id required in the path.');
      await ensureExists(client, 'tents', id, 'Tent');

      // Best-effort: remove the tent's photo objects so we don't orphan storage.
      // The tent_photos rows themselves cascade when the tent row is deleted.
      const { data: photos } = await client
        .from('tent_photos')
        .select('storage_path')
        .eq('tent_id', id);
      if (photos && photos.length > 0) {
        await client.storage.from(BUCKET).remove(photos.map((p) => p.storage_path));
      }

      const { data, error } = await client.from('tents').delete().eq('id', id).select();
      if (error) throw pgError(error);
      if (!data || data.length === 0) {
        throw new HttpError(403, 'forbidden', 'Not allowed to delete this tent.');
      }
      return json({ ok: true, id });
    }

    throw new HttpError(405, 'method_not_allowed', `${req.method} not supported.`);
  } catch (err) {
    return errorResponse(err);
  }
});
