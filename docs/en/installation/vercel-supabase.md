# Installation: Vercel + Supabase

This guide walks through setting up KunstmeileMap with **Supabase** as the
backend (database, auth, file storage) and **Vercel** for hosting the web app.
This is the recommended default path.

::: info Architecture in one sentence
The app is a purely static single-page app (React + Vite). The entire backend
runs serverless on Supabase – **no dedicated server** is required.
:::

## Prerequisites

- **Node.js ≥ 20** and **pnpm** (`npm install -g pnpm`)
- A **Supabase** account → [supabase.com](https://supabase.com)
- A **Vercel** account → [vercel.com](https://vercel.com)
- The **Supabase CLI** (`npm install -g supabase`)
- The repository cloned locally:

```bash
git clone https://github.com/jpoepke/KunstmeileMap.git
cd KunstmeileMap
pnpm install
```

## Step 1: Create a Supabase project

1. In [app.supabase.com](https://app.supabase.com) create a new project (choose a
   region close to your visitors, e.g. *Frankfurt / eu-central*).
2. Set a database password and store it safely.
3. Under **Project Settings → API** note the following values:
   - **Project URL** → becomes `VITE_SUPABASE_URL`
   - **anon public key** → becomes `VITE_SUPABASE_ANON_KEY`

## Step 2: Apply the database schema

The schema, the row-level-security rules, the `tent-photos` storage bucket and
all helper functions live as migrations under `supabase/migrations/`. Apply them
with the CLI:

```bash
# Link the CLI to your project (project-ref from the Supabase URL)
pnpm supabase link --project-ref <project-ref>

# Push all migrations to the cloud project
pnpm supabase db push
```

::: tip
`db push` automatically creates all tables (`events`, `tents`, `categories`,
`tent_photos`, `profiles`, `event_admins`), enums, RLS policies and the public
`tent-photos` storage bucket. A separate seed script is **not** needed for
production – content is created later through the admin area.
:::

Optionally, for TypeScript types matching your project:

```bash
pnpm types:gen   # writes src/types/supabase.ts
```

## Step 3: Deploy the `invite-user` edge function

Inviting users runs through a Supabase edge function (Deno):

```bash
pnpm supabase functions deploy invite-user
```

The CLI uploads the function to the linked project and injects the
`SUPABASE_SERVICE_ROLE_KEY` automatically – **no** manual env-var configuration
is needed. Details: see `supabase/functions/invite-user/README.md`.

## Step 4: Configure email / auth

Admin sign-in uses a **magic link** (email).

1. In Supabase under **Authentication → URL Configuration** set the **Site URL**
   to your future production domain (e.g. `https://kunstmeile.example.com`).
2. Also add your Vercel preview domains as **Redirect URLs** if you use preview
   deployments.

::: warning
Without a correct Site/Redirect URL, magic links lead nowhere after the click.
:::

## Step 5: Set environment variables locally

For local development:

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
VITE_DEFAULT_EVENT_SLUG=kunstmeile-2026
```

`VITE_DEFAULT_EVENT_SLUG` determines which event loads when opening the site
without an explicit slug (`/`). Test locally:

```bash
pnpm dev      # http://localhost:5173
```

A full list of all variables is in the
[Reference: Environment Variables](/en/reference/env-vars).

## Step 6: Deploy to Vercel

1. In Vercel choose **Add New → Project** and import the GitHub repository.
2. Vercel detects Vite automatically. If not:
   - **Build Command:** `pnpm build`
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install`
3. Under **Settings → Environment Variables** add the three `VITE_*` variables
   from step 5 with your **production** values (for *Production* and optionally
   *Preview*).
4. Click **Deploy**.

SPA routing is already configured via `vercel.json` – all routes are rewritten
to `index.html` so React Router takes over on the client:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

::: warning Env variables are “build-time” values
The `VITE_*` values are compiled into the JavaScript at build time. Changing the
Supabase credentials requires a **new deploy / rebuild** – updating the variable
alone is not enough.
:::

## Step 7: Create the first event

After deploying:

1. Open `https://<your-domain>/admin/login` and sign in via magic link. (The
   first user must be made a global admin – see [Users & Roles](/en/admin/users-roles).)
2. Create and publish an event – see [Managing events](/en/admin/events).
3. Set that event's slug as `VITE_DEFAULT_EVENT_SLUG` (Vercel) so it appears on
   the home page, then redeploy.

## Next steps

- [Managing events](/en/admin/events)
- [Creating tents](/en/admin/tents)
- Alternative hosting: [Azure](/en/installation/azure) · [AWS](/en/installation/aws)
