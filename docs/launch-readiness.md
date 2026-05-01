# Launch Readiness — Phase 1

This doc captures what `v1.0.0` represents, the pre-launch smoke checklist, and known deferred items. Updated as part of A4-T11.

## What `v1.0.0` represents

Phase 1 code-complete:

- A1 Foundation, A2 Public Viewer, A3 Admin CMS, A4 Polish & Compliance — all merged on `main`.
- 26 test files / 123 tests pass; `pnpm type-check` clean; `pnpm build` produces a production bundle.
- DE+EN i18n on all visitor-facing strings.
- Mobile-first responsive viewport (collapsible TopBar, side panel as bottom sheet, touch-friendly 3D camera).
- Admin role-gate (front-end redirect mirrors DB RLS posture; only `profiles.role = 'admin'` reaches `/admin`).
- A11y polish — sr-only form labels, role-tagged alerts, AdminLayout skip-link, focus-trapped dialogs, visible auth loading/error states.
- Code-split admin routes (~42 KB gz total across 10 lazy chunks; visitors who never reach `/admin` don't download admin code).
- Cookie banner with localStorage persistence + Impressum + Datenschutzerklärung (DE+EN) + OG meta + favicon.

Phase 1 does **not** include the actual capture day or the real-data load — those live in A4-T10 and A5.

## Pre-launch smoke checklist (manual)

Run on the Vercel **production** deployment of the latest `main` (not a preview):

- [ ] **Visitor flow**: open `/` → 3D scene loads → tap a marker → side panel opens with photos/links → close
- [ ] **Footer**: Impressum + Datenschutz reachable from `/`, `/:eventSlug`, `/:eventSlug/tent/:tentSlug`, and 404
- [ ] **Cookie banner**: in a private window, banner appears on first visit; click OK → vanishes; reload → still gone
- [ ] **DE↔EN**: language toggle flips both UI strings and tent descriptions; Datenschutzerklärung renders English copy when language is en
- [ ] **Admin login**: sign in as admin user → reach `/admin` (no redirect to no-access)
- [ ] **Place mode**: in admin tent edit, Place Mode raycaster places marker on splat surface
- [ ] **Photo upload**: upload a JPG via PhotoUploadZone → appears in tent's photo grid → delete works
- [ ] **Duplicate event**: open Duplicate modal → submit → new event row created
- [ ] **Vercel ↔ main**: in the Vercel dashboard, confirm `main` is the production branch and the latest commit deployed matches `git rev-parse HEAD` locally
- [ ] **Lighthouse mobile** on production URL: Performance ≥ 70, Accessibility ≥ 90, Best Practices ≥ 90

For the Lighthouse run, easiest path: Chrome DevTools → Lighthouse panel → Mobile / Performance + Accessibility + Best Practices → "Analyze page load." Alternative CLI:

```bash
pnpm dlx lighthouse https://<production-url> \
  --only-categories=performance,accessibility,best-practices \
  --form-factor=mobile \
  --view
```

## Deferred items

None of these block tagging `v1.0.0` (code-complete). Some block the **public launch** — flagged below.

| Item | Blocks public launch? | Owner | Notes |
|---|---|---|---|
| Real content load (~100 tents via CSV) | yes | organizer | A4-T10. Run via admin importer once organizer provides CSV. |
| Drone capture + real splat ingestion | yes | A5 | Phase A5 — not started. Production splats currently use the placeholder `OldTrainStation.splat`. |
| Custom domain (`Q-001`) | yes | Jan | Vercel config + DNS. Currently on Vercel-issued domain. |
| Splat hosting handoff to Cloudflare R2 (`Q-002`) | yes | A5 | Real splats too large to ship in repo; will be uploaded per-event via the admin Settings page. |
| Verein swap in Impressum/Datenschutz (Option B) | yes | Jan | Currently lists Jan Poepke as private individual. Pre-public-launch, swap to "Zukunft Börde Sittensen e.V., vertreten durch …" with Jan as Verantwortlicher. |
| Real `og-image.png` | no | Jan | Placeholder generated via `scripts/gen-og-image.mjs`. Ideal swap: a screenshot of the real splat post-capture day. |
| Toast system for sign-out errors | no | future | `AdminLayout.onSignOut` and `NoAccessPage.handleSignOut` currently log to `console.warn`. A toast UI would surface the failure to the user. |
| Migrate fetch hooks to TanStack Query | no | future | Several hooks carry `eslint-disable react-hooks/set-state-in-effect` comments awaiting this migration. |
| On-device touch testing (real iOS Safari + Android Chrome) | should before public launch | Jan | The 3D-marker tap-vs-drag threshold is set defensively (6px / 500ms) but only verified on a Samsung S25. |

## Tag sequence

When the smoke checklist is clean and Lighthouse is in range:

```bash
git tag -a v1.0.0 -m "Phase 1 code-complete (A1–A4)"
git push origin v1.0.0
```

The tag annotation should reference this doc and the merged PR set (`#13`–`#17` plus this PR).

## Reference

- Functional spec, decisions log, and per-phase plans: `C:\Users\jan.poepke\OneDrive\17_Projekte\Kunstmeile_Projekt`
- Visitor smoke checklist (manual): `tests/manual/visitor-smoke.md`
- Admin place-mode smoke: `tests/manual/place-mode-smoke.md`
