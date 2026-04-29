-- Storage bucket + policies for tent photos.
-- Bucket is public-read (so the frontend can use simple public URLs).
-- Writes are gated by event-editor role, derived from the path's first segment
-- which is the event_id by convention: tent-photos/<event_id>/<tent_id>/<file>

-- Create the bucket if it doesn't exist.
insert into storage.buckets (id, name, public)
values ('tent-photos', 'tent-photos', true)
on conflict (id) do nothing;

-- Public READ on every object in tent-photos.
create policy "tent_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'tent-photos');

-- INSERT/UPDATE/DELETE require the caller to have an editor (or admin) grant
-- on the event whose UUID is the first folder segment of the object path.
create policy "tent_photos_editor_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid)
      or is_admin()
    )
  );

create policy "tent_photos_editor_update"
  on storage.objects for update
  using (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid)
      or is_admin()
    )
  );

create policy "tent_photos_editor_delete"
  on storage.objects for delete
  using (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid)
      or is_admin()
    )
  );
