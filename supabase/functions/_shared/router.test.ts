// Run with: deno test supabase/functions
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { subPath } from './router.ts';

const req = (url: string): Request => new Request(url);

Deno.test('subPath returns [] for the collection root', () => {
  assertEquals(subPath(req('https://x.supabase.co/functions/v1/events'), 'events'), []);
});

Deno.test('subPath returns the id segment for an item', () => {
  assertEquals(subPath(req('https://x.supabase.co/functions/v1/events/abc'), 'events'), ['abc']);
});

Deno.test('subPath works without the functions/v1 prefix', () => {
  assertEquals(subPath(req('https://x.supabase.co/tents/xyz'), 'tents'), ['xyz']);
});

Deno.test('subPath ignores query strings', () => {
  assertEquals(subPath(req('https://x.supabase.co/photos?tent_id=1'), 'photos'), []);
});
