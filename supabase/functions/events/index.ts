// Edge Function: events — REST CRUD for events.
//
//   GET    /events            list events visible to the caller
//   GET    /events/{id}       one event
//   POST   /events            create (admin only — enforced by RLS)
//   PATCH  /events/{id}       update (event owner or admin)
//   DELETE /events/{id}       delete (admin only)
//
// Authorization is delegated entirely to Postgres RLS via the caller's JWT.
import { preflight } from '../_shared/cors.ts';
import { json, errorResponse, HttpError, pgError, readJson } from '../_shared/http.ts';
import { userClient, requireUser } from '../_shared/auth.ts';
import { subPath } from '../_shared/router.ts';
import { ensureExists } from '../_shared/crud.ts';
import { parseBody, EventCreate, EventUpdate } from '../_shared/validate.ts';

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return preflight();

    const client = userClient(req);
    await requireUser(client);
    const [id] = subPath(req, 'events');

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client.from('events').select('*').eq('id', id).maybeSingle();
        if (error) throw pgError(error);
        if (!data) throw new HttpError(404, 'not_found', 'Event not found.');
        return json(data);
      }
      const { data, error } = await client
        .from('events')
        .select('*')
        .order('year', { ascending: false });
      if (error) throw pgError(error);
      return json({ events: data ?? [] });
    }

    if (req.method === 'POST') {
      if (id) throw new HttpError(405, 'method_not_allowed', 'POST is for the collection.');
      const body = parseBody(EventCreate, await readJson(req));
      const { data, error } = await client.from('events').insert(body).select().single();
      if (error) throw pgError(error);
      return json(data, 201);
    }

    if (req.method === 'PATCH') {
      if (!id) throw new HttpError(400, 'missing_id', 'Event id required in the path.');
      const body = parseBody(EventUpdate, await readJson(req));
      await ensureExists(client, 'events', id, 'Event');
      const { data, error } = await client.from('events').update(body).eq('id', id).select();
      if (error) throw pgError(error);
      if (!data || data.length === 0) {
        throw new HttpError(403, 'forbidden', 'Not allowed to update this event.');
      }
      return json(data[0]);
    }

    if (req.method === 'DELETE') {
      if (!id) throw new HttpError(400, 'missing_id', 'Event id required in the path.');
      await ensureExists(client, 'events', id, 'Event');
      const { data, error } = await client.from('events').delete().eq('id', id).select();
      if (error) throw pgError(error);
      if (!data || data.length === 0) {
        throw new HttpError(403, 'forbidden', 'Not allowed to delete this event.');
      }
      return json({ ok: true, id });
    }

    throw new HttpError(405, 'method_not_allowed', `${req.method} not supported.`);
  } catch (err) {
    return errorResponse(err);
  }
});
