// Edge Function: photos — upload / list / download / manage tent photos.
//
//   GET    /photos?tent_id={id}     list a tent's photos (metadata + URLs)
//   GET    /photos/{id}             one photo (metadata + URLs)
//   GET    /photos/{id}?download=1  302 redirect to the original file
//   POST   /photos                  upload (multipart/form-data: file, tent_id,
//                                    optional caption_de, caption_en)
//   PATCH  /photos/{id}             update caption / display_order
//   DELETE /photos/{id}             delete file + row
//
// Authorization is delegated to Postgres + Storage RLS via the caller's JWT.
import { preflight } from '../_shared/cors.ts';
import {
  json,
  errorResponse,
  HttpError,
  pgError,
  storageError,
  readJson,
} from '../_shared/http.ts';
import { userClient, requireUser, supabaseUrl } from '../_shared/auth.ts';
import { subPath } from '../_shared/router.ts';
import { ensureExists } from '../_shared/crud.ts';
import { parseBody, PhotoUpdate } from '../_shared/validate.ts';
import { BUCKET, buildStoragePath, extFromName, photoUrls } from '../_shared/storage.ts';

interface PhotoRow {
  id: string;
  tent_id: string;
  storage_path: string;
  caption_de: string | null;
  caption_en: string | null;
  display_order: number;
  created_at: string;
}

function withUrls(base: string, row: PhotoRow) {
  return { ...row, ...photoUrls(base, row.storage_path) };
}

function formString(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return preflight();

    const client = userClient(req);
    await requireUser(client);
    const base = supabaseUrl();
    const [id] = subPath(req, 'photos');
    const url = new URL(req.url);

    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await client
          .from('tent_photos')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) throw pgError(error);
        if (!data) throw new HttpError(404, 'not_found', 'Photo not found.');
        const row = data as PhotoRow;
        if (url.searchParams.get('download') != null) {
          return Response.redirect(photoUrls(base, row.storage_path).url, 302);
        }
        return json(withUrls(base, row));
      }
      const tentId = url.searchParams.get('tent_id');
      if (!tentId) throw new HttpError(400, 'missing_tent_id', 'tent_id query param required.');
      const { data, error } = await client
        .from('tent_photos')
        .select('*')
        .eq('tent_id', tentId)
        .order('display_order', { ascending: true });
      if (error) throw pgError(error);
      return json({ photos: (data ?? []).map((r) => withUrls(base, r as PhotoRow)) });
    }

    if (req.method === 'POST') {
      if (id) throw new HttpError(405, 'method_not_allowed', 'POST is for the collection.');
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        throw new HttpError(400, 'invalid_form', 'Expected multipart/form-data with a file.');
      }
      const file = form.get('file');
      if (!(file instanceof File)) {
        throw new HttpError(400, 'file_required', 'A "file" part is required.');
      }
      const tentId = formString(form, 'tent_id');
      if (!tentId) throw new HttpError(400, 'missing_tent_id', 'A "tent_id" field is required.');

      // Derive event_id from the tent (also confirms the tent is visible).
      const { data: tent, error: tentErr } = await client
        .from('tents')
        .select('event_id')
        .eq('id', tentId)
        .maybeSingle();
      if (tentErr) throw pgError(tentErr);
      if (!tent) throw new HttpError(404, 'not_found', 'Tent not found.');

      // Next display_order = current max + 1 (starts at 0).
      const { data: last } = await client
        .from('tent_photos')
        .select('display_order')
        .eq('tent_id', tentId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const displayOrder = (last?.display_order ?? -1) + 1;

      const ext = extFromName(file.name, (file.type.split('/')[1] ?? 'jpg'));
      const path = buildStoragePath(tent.event_id, tentId, ext);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await client.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: file.type || 'application/octet-stream' });
      if (upErr) throw storageError(upErr);

      const { data: row, error: insErr } = await client
        .from('tent_photos')
        .insert({
          tent_id: tentId,
          storage_path: path,
          display_order: displayOrder,
          caption_de: formString(form, 'caption_de'),
          caption_en: formString(form, 'caption_en'),
        })
        .select()
        .single();
      if (insErr) {
        // Roll back the orphaned object so a failed insert doesn't leak storage.
        await client.storage.from(BUCKET).remove([path]);
        throw pgError(insErr);
      }
      return json(withUrls(base, row as PhotoRow), 201);
    }

    if (req.method === 'PATCH') {
      if (!id) throw new HttpError(400, 'missing_id', 'Photo id required in the path.');
      const body = parseBody(PhotoUpdate, await readJson(req));
      await ensureExists(client, 'tent_photos', id, 'Photo');
      const { data, error } = await client
        .from('tent_photos')
        .update(body)
        .eq('id', id)
        .select();
      if (error) throw pgError(error);
      if (!data || data.length === 0) {
        throw new HttpError(403, 'forbidden', 'Not allowed to update this photo.');
      }
      return json(withUrls(base, data[0] as PhotoRow));
    }

    if (req.method === 'DELETE') {
      if (!id) throw new HttpError(400, 'missing_id', 'Photo id required in the path.');
      const { data: row, error: rowErr } = await client
        .from('tent_photos')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle();
      if (rowErr) throw pgError(rowErr);
      if (!row) throw new HttpError(404, 'not_found', 'Photo not found.');

      const { data, error } = await client.from('tent_photos').delete().eq('id', id).select();
      if (error) throw pgError(error);
      if (!data || data.length === 0) {
        throw new HttpError(403, 'forbidden', 'Not allowed to delete this photo.');
      }
      // Row removed → drop the storage object too (best-effort).
      await client.storage.from(BUCKET).remove([row.storage_path]);
      return json({ ok: true, id });
    }

    throw new HttpError(405, 'method_not_allowed', `${req.method} not supported.`);
  } catch (err) {
    return errorResponse(err);
  }
});
