# Map Pivot — Pre-Merge Smoke

Run **all** of these against the latest `feat/map-pivot` Vercel preview. Mark each as ✅ or ❌ before approving merge.

## Public viewer
- [ ] See `tests/manual/map-public-smoke.md`.

## Admin tent editor
- [ ] See `tests/manual/map-admin-editor-smoke.md`.

## Import wizard
- [ ] See `tests/manual/map-import-wizard-smoke.md`.

## Cross-cutting
- [ ] DE/EN switch works on every page (homepage, public viewer, admin pages, import wizard, settings).
- [ ] Logged-out user: can browse public viewer, sees SidePanel + photos, cannot edit anything.
- [ ] Logged-in admin: can edit tents, set coordinates, import, change event defaults.
- [ ] Logged-in editor (non-admin): per-event role permits editing own event's tents; cannot edit other events.
- [ ] Multi-event smoke: create a second event in admin, set its default_lat/lng/zoom to a different city, switch between them — each shows its own map.
- [ ] Mobile (real device, not just devtools): public viewer behaves correctly on small screens; admin pages are usable.
- [ ] No console errors on any page. No 404s on internal navigation. SPA fallback (`vercel.json`) still works on direct deep-link.
- [ ] `pnpm test:run`, `pnpm type-check`, `pnpm lint` all clean on the branch tip.
- [ ] Vercel preview build succeeds.
