// Seeds a few demo photos into the LOCAL Supabase so the photo grid / lightbox
// screenshots have real images. Local only. Idempotent.
//
// Uploads public/og-image.png as demo photos to the first demo tents and inserts
// matching tent_photos rows. Reads URL + service-role key from `supabase status`.
//
// Run:  node scripts/seed-local-photos.mjs

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUCKET = 'tent-photos'
const SLUG = process.env.DOCS_EVENT_SLUG || 'kunstmeile-demo'
const PHOTOS_PER_TENT = { 'atelier-mueller': 3, 'keramik-studio': 2, 'foto-galerie': 1 }

function fromStatus(key) {
  try {
    const out = execSync('pnpm -s supabase status -o env', { encoding: 'utf8' })
    return out.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))?.[1]
  } catch {
    return undefined
  }
}
const URL = process.env.SUPABASE_URL || fromStatus('API_URL') || 'http://127.0.0.1:55621'
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY || fromStatus('SERVICE_ROLE_KEY')
if (!SERVICE_KEY) { console.error('No SERVICE_ROLE_KEY; is the local stack running?'); process.exit(1) }

const sb = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })
const img = readFileSync(join(ROOT, 'public', 'og-image.png'))

const { data: ev } = await sb.from('events').select('id').eq('slug', SLUG).single()
if (!ev) { console.error(`Event "${SLUG}" not found — run the seed first.`); process.exit(1) }

const { data: tents } = await sb
  .from('tents')
  .select('id,slug')
  .eq('event_id', ev.id)
  .in('slug', Object.keys(PHOTOS_PER_TENT))

let uploaded = 0
for (const tent of tents ?? []) {
  const count = PHOTOS_PER_TENT[tent.slug] ?? 1
  // clear previous demo rows for this tent (idempotent)
  await sb.from('tent_photos').delete().eq('tent_id', tent.id)
  for (let i = 0; i < count; i++) {
    const path = `${ev.id}/${tent.id}/demo-${i + 1}.png`
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, img, { contentType: 'image/png', upsert: true })
    if (upErr) { console.warn(`upload ${path}: ${upErr.message}`); continue }
    const { error: rowErr } = await sb.from('tent_photos').insert({
      tent_id: tent.id,
      storage_path: path,
      display_order: i,
      consent_recorded_at: '2026-05-20T10:00:00Z',
    })
    if (rowErr) { console.warn(`row ${path}: ${rowErr.message}`); continue }
    uploaded++
  }
}
console.log(`Seeded ${uploaded} demo photo(s) across ${tents?.length ?? 0} tent(s).`)
