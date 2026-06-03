# Reference: Environment Variables

The app reads its configuration from `VITE_*` environment variables. Locally they
live in `.env.local` (template: `.env.example`); in production, in the host's
project settings (e.g. Vercel).

::: warning Build-time values
All `VITE_*` variables are written into the JavaScript bundle at **build** time.
Changes only take effect after a **new build/deploy** – they cannot be changed at
runtime.
:::

## Required variables

| Variable | Purpose | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | URL of the Supabase project | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public “anon” API key from Supabase | `eyJhbGci…` (JWT) |
| `VITE_DEFAULT_EVENT_SLUG` | Event loaded at `/` (no slug) | `kunstmeile-2026` |

## Other variables

| Variable | Purpose |
|---|---|
| `VITE_SNAPSHOT` | When `1`, the viewer bundle runs in **offline mode** and reads embedded data instead of Supabase. Set by the web-snapshot build (`vite.viewer.config.ts`) – not needed in normal operation. |

## `.env.example`

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DEFAULT_EVENT_SLUG=kunstmeile-2026
```

::: tip Security
The **anon key** is intended for client use and is public – data protection is
enforced by the row-level-security rules in the database. The **service-role
key** must **never** go into the web app; it is used only server-side in the
`invite-user` edge function (injected automatically by Supabase).
:::

## See also

- [Installation: Vercel + Supabase](/en/installation/vercel-supabase)
- [Troubleshooting](/en/reference/troubleshooting)
