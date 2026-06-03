// Creates (or updates) a GLOBAL-admin user in the LOCAL Supabase, so the docs
// screenshot script can sign in and capture admin screens. Local only.
//
// Reads the local Supabase URL + service-role key from `supabase status -o env`
// by default, or from env overrides. Email/password default to the values
// docs-screenshots expects; override with DOCS_ADMIN_EMAIL / DOCS_ADMIN_PASSWORD.
//
// Run:  node scripts/seed-local-admin.mjs

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'

function fromStatus(key) {
  try {
    const out = execSync('pnpm -s supabase status -o env', { encoding: 'utf8' })
    const m = out.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))
    return m?.[1]
  } catch {
    return undefined
  }
}

const URL = process.env.SUPABASE_URL || fromStatus('API_URL') || 'http://127.0.0.1:55621'
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY || fromStatus('SERVICE_ROLE_KEY')
const EMAIL = process.env.DOCS_ADMIN_EMAIL || 'docs-admin@example.com'
const PASSWORD = process.env.DOCS_ADMIN_PASSWORD || 'docs-admin-1234'

if (!SERVICE_KEY) {
  console.error('No SERVICE_ROLE_KEY (and `supabase status` failed). Is the local stack running?')
  process.exit(1)
}

const sb = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Create the auth user (idempotent: fall back to lookup if it already exists).
let userId
const { data: created, error: createErr } = await sb.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
})
if (createErr) {
  if (/registered|exists/i.test(createErr.message)) {
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
    userId = list?.users?.find((u) => u.email === EMAIL)?.id
  } else {
    console.error('createUser failed:', createErr.message)
    process.exit(1)
  }
} else {
  userId = created.user.id
}

if (!userId) {
  console.error('Could not resolve user id for', EMAIL)
  process.exit(1)
}

// Promote to global admin (the handle_new_user trigger creates the profile row).
const { error: updErr } = await sb
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', userId)
if (updErr) {
  console.error('Failed to set profile role=admin:', updErr.message)
  process.exit(1)
}

console.log(`Local admin ready:\n  email:    ${EMAIL}\n  password: ${PASSWORD}\n  user id:  ${userId}`)
