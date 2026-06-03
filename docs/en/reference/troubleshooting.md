# Reference: Troubleshooting

Common problems and their fixes.

## The app loads but shows no map / no tents

- **Event not published:** Only events with *published* status are publicly
  visible. Check the status in the [settings](/en/admin/events#status-visibility).
- **Wrong default slug:** `VITE_DEFAULT_EVENT_SLUG` must exactly match the slug
  of a published event. After changing it, **redeploy**.
- **Tents without coordinates:** Tents without `lat`/`lng` don't appear on the
  map (note the banner). Set positions in the
  [positions editor](/en/admin/tents#set-positions-in-bulk).

## Magic-link login doesn't work

- **Missing Site/Redirect URL:** In Supabase under
  **Authentication → URL Configuration**, set the production domain as *Site URL*
  and all preview domains as *Redirect URLs*.
- **Link expired:** Magic links are only valid briefly – request a new one.

## “No access” after login

The user is signed in but not assigned to any event. An **Owner** or global admin
must [invite](/en/admin/users-roles#invite-a-user) them.

## Subpage / reload results in 404

The SPA fallback rule is missing on the host:

- **Vercel:** `vercel.json` with a rewrite to `/index.html` is present.
- **Azure:** `staticwebapp.config.json` with `navigationFallback` – see the
  [Azure guide](/en/installation/azure#step-1-configure-the-spa-fallback).
- **AWS:** CloudFront error pages 403/404 → `/index.html` (200) – see the
  [AWS guide](/en/installation/aws#step-4-spa-fallback-important).

## Changing Supabase credentials has no effect

`VITE_*` variables are baked in at **build time**. After any change, trigger a
**new deploy / rebuild**.

## Images don't show / upload fails

- **Bucket missing:** The `tent-photos` bucket is created by the migrations
  (`supabase db push`). Check that all migrations are applied.
- **Drag & drop on mobile:** The drop zone is desktop-only; on mobile use the
  camera/gallery upload (see [Photos](/en/admin/photos)).

## CLI / migrations

- `supabase db push` fails → first run `supabase link --project-ref <ref>` and
  make sure the CLI is logged in (`supabase login`).
- On **Windows/PowerShell**, watch the output redirection when generating type
  files (`>` writes UTF‑16; verify the file is UTF‑8 if needed).

## See also

- [Environment Variables](/en/reference/env-vars)
- [Installation: Vercel + Supabase](/en/installation/vercel-supabase)
