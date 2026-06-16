// Run with: deno test supabase/functions
import {
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildStoragePath, extFromName, photoUrls } from './storage.ts';

Deno.test('extFromName lowercases and falls back', () => {
  assertEquals(extFromName('Photo.JPG'), 'jpg');
  assertEquals(extFromName('no-ext'), 'jpg');
  assertEquals(extFromName('weird.tooooolong', 'png'), 'png');
  assertEquals(extFromName('image.png'), 'png');
});

Deno.test('buildStoragePath uses the <event>/<tent>/<uuid>.<ext> layout', () => {
  const path = buildStoragePath('e1', 't1', 'png');
  assertMatch(path, /^e1\/t1\/[0-9a-f-]{36}\.png$/);
});

Deno.test('photoUrls builds public + transformed URLs', () => {
  const u = photoUrls('https://x.supabase.co', 'e1/t1/a.jpg');
  assertStringIncludes(u.url, '/storage/v1/object/public/tent-photos/e1/t1/a.jpg');
  assertStringIncludes(u.thumb_url, '/render/image/public/tent-photos/e1/t1/a.jpg?width=640');
  assertStringIncludes(u.full_url, 'width=1600');
  assertStringIncludes(u.full_url, 'quality=72');
});
