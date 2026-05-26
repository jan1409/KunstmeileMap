# Map Pivot — Design Spec

**Date:** 2026-05-26
**Status:** Implemented in feat/map-pivot — see docs/superpowers/plans/2026-05-26-map-pivot.md
**Author:** Brainstorm session with Jan
**Target branch:** `feat/map-pivot`
**Hard deadline:** 2026-05-31 (Phase 1 launch)

## Context and rationale

Phase 1 of the Kunstmeile Web App was originally designed around a photoreal Gaussian-Splat scene captured from drone footage as its core differentiator. The capture pipeline did not yield a usable splat asset in time, and a second drone flight is no longer possible before the launch deadline. We therefore pivot the public viewer from a 3D-GS scene to a 2D OpenStreetMap-based view while preserving everything else that was built in Phase 1: the data model, the admin CMS, the photo gallery, multi-event support, DE/EN i18n, authentication, and mobile-first UX.

Walk Mode (PR #27, currently open) is closed without merge. The walk-mode spec and plan documents remain on `main` as reference material — the feature is parked for a possible next-year iteration when a fresh GS asset exists.

## Out of scope

- New 3D capture or processing
- Walk Mode revival
- Self-service exhibitor onboarding (Phase 2)
- Stylized iso-diorama "home view" (Phase 2)
- Per-tent GS "step inside" bubbles (Phase 3)
- Paid tile provider integration (deferred; OSM direct sufficient for launch scale)

## Locked decisions (from brainstorming)

| # | Decision |
|---|----------|
| MP-001 | Map library: **Leaflet** + **react-leaflet** (battle-tested, mobile-stable, no token required for OSM). |
| MP-002 | Admin coordinate UX: **click + drag + lat/lng input fields**, all three synchronized via React Hook Form state. |
| MP-003 | Event-level map center: **per-event `default_lat`, `default_lng`, `default_zoom`** on the `events` table (Phase-1 multi-event constraint). |
| MP-004 | Bulk import: **accept both `.csv` and `.xlsx`** (PapaParse + SheetJS, parser selected by file extension). |
| MP-005 | Import columns: name, display_number, slug (auto-gen if empty), category_slugs, description_de, description_en, address, website_url, instagram_url, facebook_url, email_public, lat, lng. Coordinates optional — set later in admin map editor. |
| MP-006 | GS cleanup: **full removal** of Spark, Three.js, walk-mode controller, place-mode, 3D markers, and related tests. Spec/plan docs for walk-mode remain on `main` as reference. |
| MP-007 | PR #27 disposition: **close without merge**, delete branch. Walk-mode spec/plan docs stay on `main`. |
| MP-008 | Tent photos (TentPhoto-Tabelle, Upload-UI, Gallery in SidePanel): **unchanged** — independent of the GS pipeline. |
| MP-009 | Mobile preview screenshots in the working tree: **delete** (walk-mode test artefacts, not pivot-relevant). |
| MP-010 | Migration strategy: **single long-lived `feat/map-pivot` branch** with phased commits (T1–T6), single squash-merge at the end. Vercel preview updates per push. |

## What the existing codebase already provides

Re-confirmed during brainstorming — these are **kept as-is**:

- `tents` table already has `website_url`, `instagram_url`, `facebook_url`, `email_public`, `address` (since the initial migration `20260429120000_initial_schema.sql`).
- `TentEditForm.tsx` already renders all social/contact fields with zod 4 URL/email validation.
- `SidePanel.tsx` already renders the social links in the public view ([SidePanel.tsx:87-119](../../../src/components/SidePanel.tsx#L87-L119)) with 🌐 📷 👍 icons.
- `TentImportPage.tsx` already exists — currently CSV-only via PapaParse, with all social/contact columns. **It will be refactored** (not rebuilt) to swap `x, y, z` → `lat, lng`, add `.xlsx` support via SheetJS, and add a multi-step wizard with per-row validation.

## Data model changes

### Single new migration: `supabase/migrations/20260526120000_map_pivot_schema.sql`

**`tents`:**
- DROP `position` (jsonb) — was `{x, y, z}` for 3D scene placement.
- ADD `lat double precision NULL`
- ADD `lng double precision NULL`
- ADD CHECK constraint: `(lat IS NULL AND lng IS NULL) OR (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)`
- ADD partial index: `CREATE INDEX tents_lat_lng_idx ON tents (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;`

**`events`:**
- ADD `default_lat double precision NOT NULL DEFAULT 49.0`
- ADD `default_lng double precision NOT NULL DEFAULT 8.4`
- ADD `default_zoom smallint NOT NULL DEFAULT 17`
- Defaults are placeholders; the first event's real coordinates are set by the user post-migration (either via a separate `UPDATE` statement or via the admin event-settings UI added in T4).

**RPC updates:**
- `duplicate_event_rpc` (`20260430120000_duplicate_event_rpc.sql`): references `position` in tent INSERT — must reference `lat, lng`.
- The tent-renumbering / multi-category trigger work in `20260501120000_tent_numbers_and_multi_category.sql` references `position` in its history-table inserts — must reference `lat, lng`. (Audit during T1; replace literally rather than rewriting the trigger logic.)

**Types regeneration:**
- Run `pnpm types:gen` after applying the migration, commit the regenerated `src/types/supabase.ts` in the same commit as the migration.

## Code architecture changes

### Components and files to delete

| Path | Reason |
|---|---|
| `src/components/viewer/SplatViewer.tsx` | GS renderer |
| `src/components/viewer/WalkModeButton.tsx` | Walk-mode UI |
| `src/components/viewer/WalkModeController.ts` | Walk-mode controller class |
| `src/lib/walkMode.ts`, `src/lib/walkAnimateTo.ts` | Walk-mode helpers |
| `src/components/viewer/SignPostMarker.tsx` (or current name) | 3D marker |
| `src/components/viewer/PlaceMode.tsx` | 3D place-mode |
| Any test under `tests/` referencing the above | Dead tests |
| `tests/manual/walkMode-*.md` | Manual smoke checklists for walk-mode |
| Loose screenshots in repo root (`MobilePictureProblem.png`, `MobileViewIssue.png`, `SamsungS25.png`) | Walk-mode preview artefacts |

The exact file inventory is verified during T2 (the cleanup commit); the list above is the intent.

### Dependencies to remove

- `@sparkjsdev/spark`
- `three` and `@types/three`
- Any downstream-only deps (e.g., `troika-three-text`) — verified during T2.

### Dependencies to add

- `leaflet@^1.9.4` (stable, mobile-tested)
- `react-leaflet` (latest compatible with React 19 — verify; fall back to `react-leaflet@^5` if `@^4.2` is incompatible)
- `@types/leaflet`
- `xlsx@^0.20` (SheetJS, for `.xlsx` parsing in the import wizard)

`papaparse` stays — already in use for the CSV import path.

### Components to create

| Path | Purpose |
|---|---|
| `src/components/viewer/MapView.tsx` | Top-level Leaflet map for the public viewer. Replaces `SplatViewer` in `EventViewPage`. |
| `src/components/viewer/TentMarker.tsx` | Custom DivIcon-based marker per tent. Category-colored, displays `display_number`. |
| `src/components/admin/TentMapEditor.tsx` | Embedded Leaflet map in the admin tent-edit form. Click/drag/field-input synced via RHF. |
| `src/lib/map.ts` | Pure helpers: `isValidCoord`, `computeBounds`, `clampZoom`, `markerColorForCategories`. |
| `src/lib/excel.ts` | Pure helpers: parser selection by file extension, `parseSheet`, `validateRow`, `mapColumnsToTent`. |

### Components to modify

| Path | Change |
|---|---|
| `src/pages/EventViewPage.tsx` | Replace `SplatViewer` with `MapView`. Keep SidePanel, filter, category-color logic. Replace `flyTo(position)` with `panTo({lat, lng}, zoom)`. Replace "Back to overview" reset target with event default. |
| `src/components/TentEditForm.tsx` | Insert `TentMapEditor` block under "Position auf der Karte". Add RHF fields `lat`, `lng`. Remove any UI bound to `position.x/y/z`. |
| `src/pages/admin/TentImportPage.tsx` | Refactor: support `.csv` + `.xlsx`, multi-step wizard (upload → preview/validate → commit), per-row validation report, swap `x, y, z` → `lat, lng`. Slug becomes auto-generated when blank. |
| `src/pages/admin/AdminEventPage.tsx` (or current event-settings page) | Add inputs for `default_lat`, `default_lng`, `default_zoom`. Optional embedded mini-map for visual confirmation. |
| `src/routes.tsx` | Keep `/admin/events/:slug/tents/import` route (already exists). |
| `src/locales/de/common.json`, `src/locales/en/common.json` | Add new keys (map, import wizard). Remove orphan walk-mode keys. |

The `SidePanel` and tent-photo flow remain untouched.

## Public viewer UX (`/events/:slug`)

- Map initializes at `events.default_lat / default_lng / default_zoom`.
- Tents with `lat` and `lng` set render as `TentMarker` (DivIcon: colored circle with `display_number` label).
  - Multi-category tents use the first category's color plus a thin multi-color border.
  - Marker `renderOrder`/`z-index` is handled by Leaflet — no manual layering needed.
- Filter by category: matching markers stay visible; non-matching markers hide (consistent with current "hide instead of dim" pattern from PR #24).
- Click a marker: existing `SidePanel` opens (right on desktop, bottom on mobile). The map smoothly pans so the marker is not occluded by the panel (~150px offset).
- "Back to overview" button: resets map view to `default_lat / default_lng / default_zoom`. Closes SidePanel.
- Tents with `lat IS NULL OR lng IS NULL`:
  - Not rendered on the map.
  - A small banner ("`X stands are not yet placed on the map`") appears, dismissable. For admins/editors logged in, the banner links to the admin tent list.
- OSM tile attribution rendered via Leaflet's built-in control (bottom-right). Required by OSM's terms.
- Tile URL template: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`. Sufficient for launch-scale traffic. If traffic grows, migrate to a paid tier later (out of scope).

## Admin coordinate UX (TentEditPage)

A new map block in the existing tent-edit form:

- **Lat / Lng inputs** (number, editable). RHF-bound. Validation: each in valid range, both null OR both set.
- **Embedded Leaflet map** showing the tent's current marker (if coords set) plus other event tents (faded, read-only) for spatial context.
- Click anywhere on the map: sets the marker, updates RHF lat/lng.
- Drag the marker: updates RHF lat/lng live.
- Edit the lat/lng inputs: marker jumps; map pans if the new position is off-screen.
- "Koordinaten löschen" button: clears both fields to null. Tent disappears from the public map.

All three input paths converge on the same RHF state; RHF is source of truth, map and inputs are views.

## Bulk import wizard (TentImportPage)

Three steps inside the existing `/admin/events/:slug/tents/import` route.

### Step 1 — Upload

- File picker accepts `.csv` and `.xlsx`.
- "Vorlage herunterladen" link → `public/import-template.xlsx` (static file, ships with the build).
- "Weiter" enabled once a file is parsed successfully.

### Step 2 — Preview & validation

Table view of every parsed row with status:

- ✅ row passes all checks → import target.
- ⚠️ row has warnings (e.g., unknown category slugs that will be skipped, blank coordinates) — still importable.
- ❌ row has errors (duplicate `display_number` within this event, missing required field, invalid coord range) — excluded from import.

Buttons: "Zurück" (re-upload), "Nur OK-Zeilen importieren (N)".

### Step 3 — Commit & result

- Per-tent insert via the existing `supabase.from('tents').insert(...)` pattern, then `tent_categories` join inserts. Each tent is one INSERT — atomic at the tent level. If a row fails (e.g., race-condition duplicate `display_number`), subsequent rows continue and the error is logged in the report. No half-tent state (a tent that fails the join-insert step is logged with a warning; the tent row still exists).
- If we later need full-batch transactional atomicity, wrap the inserts in a Postgres RPC (`import_tents(rows jsonb)`) — out of scope for the initial pivot.
- Result screen: "N tents imported, M rows skipped". Download import report as CSV.

### Column spec

| Column | Required? | Validation | Notes |
|---|---|---|---|
| `slug` | No | kebab-case if provided | Auto-generated from `name` if blank. Must be unique within event. |
| `name` | Yes | non-empty | |
| `display_number` | Yes | integer or alphanumeric (`A-7`); type follows existing schema | Unique within event. |
| `category_slugs` | No | comma-separated; unknown slugs warned and skipped | Joined into `tent_categories`. |
| `description_de` | No | — | |
| `description_en` | No | — | |
| `address` | No | — | |
| `website_url` | No | URL if provided | Existing zod `z.url()`. |
| `instagram_url` | No | URL if provided | |
| `facebook_url` | No | URL if provided | |
| `email_public` | No | email if provided | Existing zod `z.email()`. |
| `lat` | No | `-90..90` if provided | Both lat and lng must be set together or both null. |
| `lng` | No | `-180..180` if provided | |

### Parsing

- File extension → parser selection. `.csv` → PapaParse. `.xlsx` → SheetJS (`xlsx`).
- Parsing happens client-side in the browser. Bundle impact: ~250 KB for `xlsx` (acceptable for an admin-only page; admin bundles can be split via lazy import if needed).
- Both parsers normalize to a common `ParsedRow` shape that the validation/preview/commit steps consume.

## Migration sequence (six tasks on `feat/map-pivot`)

| # | Task | Est. | Key commits |
|---|------|------|-------------|
| T1 | Schema migration + types regen | ~2h | `feat(db): replace tent 3d position with lat/lng + event default map view`, `feat(types): regenerate supabase.ts` |
| T2 | GS cleanup (dependencies, files, tests, screenshots) | ~3h | `chore(deps): remove three.js and @sparkjsdev/spark`, `refactor(viewer): remove SplatViewer, WalkMode, PlaceMode, 3D markers`, `refactor(tests): remove 3d-specific tests`, `chore(repo): remove stale screenshots` |
| T3 | Public MapView (Leaflet, TentMarker, EventViewPage rewire, no-coords banner, i18n) | ~5h | `feat(deps): add leaflet, react-leaflet`, `feat(lib): pure map helpers`, `feat(viewer): TentMarker`, `feat(viewer): MapView`, `feat(viewer): EventViewPage uses MapView`, `feat(viewer): back-to-overview pans to event default`, `feat(viewer): banner for tents without coords`, `feat(i18n): map strings` |
| T4 | Admin TentMapEditor (click/drag/fields, clear-coords, event-settings default map view) | ~4h | `feat(admin): TentMapEditor`, `feat(admin): TentEditForm integrates TentMapEditor`, `feat(admin): clear-coordinates action`, `feat(admin): event default map view settings` |
| T5 | Import wizard refactor (SheetJS, multi-step UI, validation, lat/lng) | ~4h | `feat(deps): add xlsx`, `refactor(admin): TentImportPage wizard`, `feat(admin): csv + xlsx parser selection`, `feat(admin): per-row validation with report`, `feat(admin): downloadable import template`, `feat(i18n): import wizard strings` |
| T6 | i18n cleanup, manual smoke checklist, final smoke | ~2h | `chore(i18n): remove orphaned walk-mode strings`, `docs(specs): map pivot spec marked complete`, `docs(manual): smoke checklist for map pivot` |

Total estimate: ~20 hours. Buffer until 2026-05-31.

## Test strategy

Per `feedback_workflow.md`:

- **TDD per behavior change** for pure helpers (`src/lib/map.ts`, `src/lib/excel.ts`). Failing test → minimal implementation → green → commit.
- **Component tests** for `TentMarker`, `MapView` (react-leaflet mocked), `TentMapEditor` (RHF state sync), import wizard steps. Use the existing Vitest + RTL setup.
- **Manual smoke checklists** for the visual/interactive Leaflet behavior — `tests/manual/map-public.md`, `tests/manual/map-admin-editor.md`, `tests/manual/map-import-wizard.md`. (Cypress/Playwright is out of scope for the deadline; manual smoke is the established 3D-equivalent pattern.)
- **Before every commit:** `pnpm test:run && pnpm type-check && pnpm lint` clean; diff shown for review; commit only after explicit OK.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `react-leaflet` peer-dep on React 19 not yet stable | Verify install during T3; fall back to `react-leaflet@^5` (React 18 compatible) — Phase 1 doesn't depend on React 19-specific features. |
| OSM tile usage policy | Add `User-Agent` header where Leaflet allows; attribution is already automatic. Production load is ~hundreds of visitors over one weekend — well below the "moderate use" threshold. |
| Existing RPC (`duplicate_event_rpc`, multi-category trigger) accesses `position` | Audit and patch during T1 in the same commit as the schema migration. |
| Bundle size from SheetJS in the public bundle | Lazy-import `xlsx` from inside `TentImportPage` only — admin-route bundle, not public-route bundle. |
| Mid-pivot, an admin tries to edit a tent during the migration window | Acceptable — admin CMS access is restricted; we control timing of the production migration push. |

## Manual cleanup before T1

User actions before kicking off the branch:

1. Close PR #27 (`gh pr close 27 --comment "Closing without merge — walk mode parked for next year, see specs/2026-05-03-walk-mode-design.md"`). Either user does this or grants permission for Claude to do it.
2. Provide GPS coordinates and zoom level for the first event (the only existing event today). The values will populate `events.default_lat`, `default_lng`, `default_zoom` for that row.

## Acceptance criteria (smoke for the pre-merge gate)

The map pivot ships when:

1. `pnpm test:run`, `pnpm type-check`, `pnpm lint` are all clean on the branch tip.
2. Public viewer at `/events/:slug` shows a Leaflet map centered on the event's default coordinates. All tents with coordinates render as markers; clicking a marker opens the existing SidePanel; the category filter hides/shows markers; "Back to overview" resets the view; DE/EN switch works; mobile-touch (pinch-zoom, drag-pan, marker-tap) works.
3. Admin tent-edit page shows the new map block. Click/drag/field inputs all update lat/lng in sync. "Koordinaten löschen" clears both. Saved tent appears on the public map at the right spot.
4. Event-settings page lets admins change `default_lat`, `default_lng`, `default_zoom`. The change reflects on the public map's initial view.
5. Import wizard accepts both `.xlsx` and `.csv`. Preview step flags errors/warnings per row. Commit step imports only the OK rows. Imported tents appear in the admin tent list and (if coordinates were provided) on the public map.
6. No references to Spark, Three.js, walk-mode, or place-mode remain in the source. No orphaned i18n keys.
7. OSM attribution is visible on the public map.

## Open questions

None — all design decisions are locked above. Implementation can proceed via the writing-plans skill.
