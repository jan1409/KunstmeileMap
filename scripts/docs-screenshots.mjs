// Captures the documentation screenshots listed in screenshots.manifest.mjs by
// driving the running app with a headless browser, and writes them to
// docs/public/assets/screenshots/ (overwriting the placeholders).
//
// Prerequisites:
//   1. A demo event is seeded (see supabase/seed-demo.sql) with slug
//      DOCS_EVENT_SLUG (default "kunstmeile-demo").
//   2. The app dev server is running:  pnpm dev   (http://localhost:5173)
//   3. Chromium for Playwright is installed once:  pnpm playwright install chromium
//   4. For ADMIN screenshots, set a GLOBAL-admin login in the environment:
//        DOCS_ADMIN_EMAIL=...  DOCS_ADMIN_PASSWORD=...
//      (omit them to capture only the public screenshots).
//
// Env (all optional, with defaults):
//   BASE_URL          http://localhost:5173
//   DOCS_EVENT_SLUG   kunstmeile-demo
//   DOCS_ADMIN_EMAIL / DOCS_ADMIN_PASSWORD
//
// Supabase URL/anon key are read from .env.local (same file the app uses).
//
// Run:  pnpm docs:shots
//
// The run is defensive: every step is independent; if one interaction fails the
// step is skipped (its placeholder stays) and the rest continue.

import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DESKTOP, MOBILE } from './screenshots.manifest.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'docs', 'public', 'assets', 'screenshots')

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const SLUG = process.env.DOCS_EVENT_SLUG ?? 'kunstmeile-demo'
const ADMIN_EMAIL = process.env.DOCS_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.DOCS_ADMIN_PASSWORD

// ---- read Supabase creds from .env.local ----
function readEnvLocal() {
  const out = {}
  const p = join(ROOT, '.env.local')
  if (!existsSync(p)) return out
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}
const env = readEnvLocal()
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY

// ---- helpers ----
const save = (page, path) => {
  const target = join(OUT_DIR, path)
  mkdirSync(dirname(target), { recursive: true })
  return page.screenshot({ path: target })
}
const settle = async (page, ms = 900) => {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}
const waitMap = (page) =>
  page.waitForSelector('.leaflet-container', { timeout: 15000 }).catch(() => {})

let captured = 0
let skipped = 0
async function step(name, fn) {
  try {
    await fn()
    captured++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    skipped++
    console.warn(`  ✗ ${name} — ${err?.message ?? err}`)
  }
}

// ---- obtain an admin session (optional) ----
let adminSession = null
let storageKey = null
if (ADMIN_EMAIL && ADMIN_PASSWORD && SUPABASE_URL && SUPABASE_ANON) {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false },
    })
    const { data, error } = await sb.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    })
    if (error) throw error
    adminSession = data.session
    // supabase-js v2 persists the session under `sb-<project-ref>-auth-token`.
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0]
    storageKey = `sb-${ref}-auth-token`
    console.log(`Admin login ok (${ADMIN_EMAIL}).`)
  } catch (err) {
    console.warn(`Admin login failed, capturing public shots only — ${err?.message ?? err}`)
  }
} else {
  console.log('No admin credentials provided — capturing public shots only.')
}

const browser = await chromium.launch()

async function newContext(viewport, { auth = false } = {}) {
  const isMobile = viewport === 'mobile'
  const ctx = await browser.newContext({
    viewport: isMobile ? MOBILE : DESKTOP,
    deviceScaleFactor: 2,
    hasTouch: isMobile,
    isMobile,
    userAgent: isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
      : undefined,
  })
  if (auth && adminSession && storageKey) {
    const value = JSON.stringify(adminSession)
    await ctx.addInitScript(
      ([k, v]) => window.localStorage.setItem(k, v),
      [storageKey, value],
    )
  }
  return ctx
}

// ===================== PUBLIC (visitor) =====================
{
  const ctx = await newContext('desktop')
  const page = await ctx.newPage()

  await step('user/map-overview.png', async () => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await waitMap(page)
    await settle(page)
    await save(page, 'user/map-overview.png')
  })

  await step('user/map-satellite.png', async () => {
    const toggle = page.getByRole('button', { name: /satellit|satellite|luftbild/i }).first()
    await toggle.click({ timeout: 4000 })
    await settle(page)
    await save(page, 'user/map-satellite.png')
    // back to street map for following shots
    await page.getByRole('button', { name: /straßenkarte|street|karte|map/i }).first().click({ timeout: 4000 }).catch(() => {})
    await settle(page, 400)
  })

  await step('user/marker-detail.png', async () => {
    // zoom in a couple steps to reveal numbered badges
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /zoom in|vergrößern|\+/i }).first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(500)
    }
    await settle(page)
    await save(page, 'user/marker-detail.png')
  })

  await step('user/search-dropdown.png', async () => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await waitMap(page)
    const box = page.getByRole('searchbox').or(page.getByPlaceholder(/such|search/i)).first()
    await box.click({ timeout: 4000 })
    await box.fill('a')
    await settle(page, 600)
    await save(page, 'user/search-dropdown.png')
  })

  await step('user/category-filter.png', async () => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await waitMap(page)
    await settle(page)
    await save(page, 'user/category-filter.png')
  })

  await step('user/side-panel.png', async () => {
    await page.goto(`${BASE_URL}/${SLUG}/tent/atelier-mueller`)
    await waitMap(page)
    await settle(page)
    await save(page, 'user/side-panel.png')
  })

  await step('user/photo-lightbox.png', async () => {
    // requires a tent with photos; click the first thumbnail in the panel
    await page.goto(`${BASE_URL}/${SLUG}/tent/atelier-mueller`)
    await waitMap(page)
    await settle(page)
    await page.locator('img').filter({ hasNot: page.locator('.leaflet-container img') }).last().click({ timeout: 4000 })
    await settle(page, 600)
    await save(page, 'user/photo-lightbox.png')
  })

  await step('user/desktop-overview.png', async () => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await waitMap(page)
    await settle(page)
    await save(page, 'user/desktop-overview.png')
  })

  await ctx.close()
}

// ===================== PUBLIC (mobile) =====================
{
  const ctx = await newContext('mobile')
  const page = await ctx.newPage()

  await step('user/mobile-map.png', async () => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await waitMap(page)
    await settle(page)
    await save(page, 'user/mobile-map.png')
  })

  await step('user/mobile-menu.png', async () => {
    await page.getByRole('button', { name: /menü|menu|filter|such/i }).first().click({ timeout: 4000 })
    await settle(page, 500)
    await save(page, 'user/mobile-menu.png')
  })

  await step('user/mobile-drawer.png', async () => {
    await page.goto(`${BASE_URL}/${SLUG}/tent/atelier-mueller`)
    await waitMap(page)
    await settle(page)
    await save(page, 'user/mobile-drawer.png')
  })

  await ctx.close()
}

// ===================== ADMIN =====================
{
  // login page is public
  const pub = await newContext('desktop')
  const lp = await pub.newPage()
  await step('admin/login.png', async () => {
    await lp.goto(`${BASE_URL}/admin/login`)
    await settle(lp)
    await save(lp, 'admin/login.png')
  })
  await pub.close()

  if (!adminSession) {
    console.log('Skipping authenticated admin screenshots (no admin session).')
  } else {
    const ctx = await newContext('desktop', { auth: true })
    const page = await ctx.newPage()

    const adminShots = [
      ['admin/dashboard.png', `/admin`],
      ['admin/event-list.png', `/admin/events`],
      ['admin/event-settings.png', `/admin/events/${SLUG}/settings`],
      ['admin/tent-list.png', `/admin/events/${SLUG}/tents`],
      ['admin/category-list.png', `/admin/events/${SLUG}/categories`],
      ['admin/import-wizard.png', `/admin/events/${SLUG}/tents/import`],
      ['admin/positions-editor.png', `/admin/events/${SLUG}/positions`],
      ['admin/users-page.png', `/admin/events/${SLUG}/users`],
    ]
    for (const [path, route] of adminShots) {
      await step(path, async () => {
        await page.goto(`${BASE_URL}${route}`)
        await settle(page)
        await save(page, path)
      })
    }

    // category edit form — shows the color picker + preset swatches
    await step('admin/category-color-form.png', async () => {
      await page.goto(`${BASE_URL}/admin/events/${SLUG}/categories`)
      await settle(page)
      await page.getByRole('button', { name: /bearbeiten|edit/i }).first().click({ timeout: 5000 })
      await settle(page, 400)
      await save(page, 'admin/category-color-form.png')
    })

    // tent edit form (first tent) + embedded map editor
    await step('admin/tent-edit.png', async () => {
      await page.goto(`${BASE_URL}/admin/events/${SLUG}/tents`)
      await settle(page)
      await page.getByRole('link', { name: /bearbeiten|edit|atelier/i }).first().click({ timeout: 5000 })
      await settle(page)
      await save(page, 'admin/tent-edit.png')
    })
    await step('admin/tent-map-editor.png', async () => {
      await waitMap(page)
      const map = page.locator('.leaflet-container').first()
      await map.scrollIntoViewIfNeeded().catch(() => {})
      await settle(page, 400)
      await save(page, 'admin/tent-map-editor.png')
    })
    await step('admin/photos-grid.png', async () => {
      await save(page, 'admin/photos-grid.png')
    })

    // event settings → export buttons; duplicate modal; invite form
    await step('admin/export-buttons.png', async () => {
      await page.goto(`${BASE_URL}/admin/events/${SLUG}/settings`)
      await settle(page)
      await page.getByText(/export/i).first().scrollIntoViewIfNeeded().catch(() => {})
      await settle(page, 300)
      await save(page, 'admin/export-buttons.png')
    })
    await step('admin/event-duplicate.png', async () => {
      await page.goto(`${BASE_URL}/admin/events`)
      await settle(page)
      await page.getByRole('button', { name: /duplizier|duplicate/i }).first().click({ timeout: 5000 })
      await settle(page, 500)
      await save(page, 'admin/event-duplicate.png')
    })
    await step('admin/invite-user.png', async () => {
      await page.goto(`${BASE_URL}/admin/events/${SLUG}/users`)
      await settle(page)
      await page.getByText(/einladen|invite/i).first().scrollIntoViewIfNeeded().catch(() => {})
      await settle(page, 300)
      await save(page, 'admin/invite-user.png')
    })
    await step('admin/photo-dropzone.png', async () => {
      await page.goto(`${BASE_URL}/admin/events/${SLUG}/tents`)
      await settle(page)
      await page.getByRole('link', { name: /bearbeiten|edit|atelier/i }).first().click({ timeout: 5000 })
      await settle(page)
      await page.getByText(/ziehen|drop|drag|hochladen|upload/i).first().scrollIntoViewIfNeeded().catch(() => {})
      await settle(page, 300)
      await save(page, 'admin/photo-dropzone.png')
    })

    await ctx.close()
  }
}

await browser.close()
console.log(`\nScreenshots: ${captured} captured, ${skipped} skipped.`)
if (skipped > 0) {
  console.log('Skipped shots keep their placeholder image. Re-run after fixing the cause (server not running, selectors changed, no photos seeded, etc.).')
}
