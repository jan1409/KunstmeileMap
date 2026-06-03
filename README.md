# Kunstmeile Web App (KunstmeileMap)

Interactive map and exhibitor directory for the Kunstmeile, with an admin CMS for
organizers. Fully bilingual (German / English).

## Tech stack

React 19 + TypeScript + Vite + Tailwind CSS, with **Supabase** (PostgreSQL, Auth,
Storage, Edge Functions) as the backend and **Leaflet** for the map. Deployed as
a static SPA (default: Vercel).

## Local dev

1. `cp .env.example .env.local` and fill in real Supabase values from the project
   dashboard.
2. `pnpm install`
3. `pnpm dev` → http://localhost:5173

See [`docs/`](docs/) for full setup and deployment instructions.

## Documentation

User and setup documentation lives in [`docs/`](docs/) (bilingual DE/EN) and is
published as a website via GitHub Pages.

- **Browse the Markdown** directly in [`docs/`](docs/).
- **Local preview** of the docs site: `pnpm docs:dev`
- **Build** the docs site: `pnpm docs:build`

It covers installation & deployment (Vercel + Supabase, plus Azure and AWS),
admin guides (events, tents, categories, import/export, photos, users) and
end-user guides (using the map on mobile and desktop).

### Screenshots

Documentation screenshots are committed under
`docs/public/assets/screenshots/`. They are generated, not hand-taken:

1. Seed demo data: run `supabase/seed-demo.sql` against a local/throwaway
   Supabase project.
2. Start the app: `pnpm dev`
3. Install the browser once: `pnpm playwright install chromium`
4. Capture: `pnpm docs:shots`
   - Public screenshots need no login.
   - Admin screenshots need a global-admin login via env vars
     `DOCS_ADMIN_EMAIL` / `DOCS_ADMIN_PASSWORD`.

If you don't run the capture, neutral placeholder images are used instead
(regenerate with `pnpm docs:placeholders`).

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` | Run / build the app |
| `pnpm test` | Vitest |
| `pnpm docs:dev` / `pnpm docs:build` | Run / build the docs site |
| `pnpm docs:shots` | Capture documentation screenshots |
