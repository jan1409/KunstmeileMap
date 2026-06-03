# Alternative: AWS S3 + CloudFront

KunstmeileMap can also run on AWS as a static single-page app: **S3** stores the
files, **CloudFront** serves them worldwide over HTTPS. The backend stays
**Supabase**.

::: info What stays the same?
Supabase (database, auth, storage, the `invite-user` edge function) is set up as
in the [Vercel guide](/en/installation/vercel-supabase) (steps 1–5). This page
only replaces the hosting.
:::

## Prerequisites

- Supabase is already set up.
- An **AWS** account and the **AWS CLI** (`aws configure`).
- The app builds locally (`pnpm build` produces `dist/`).

## Step 1: Create a production build

The `VITE_*` variables must be set at build time (in `.env.local` or as shell
variables):

```bash
pnpm install
pnpm build      # produces dist/
```

## Step 2: Create an S3 bucket

```bash
aws s3 mb s3://kunstmeile-app --region eu-central-1
```

Do **not** make the bucket public – access goes exclusively through CloudFront
(Origin Access Control). Upload the contents:

```bash
# cache hashed assets for a long time
aws s3 sync dist/ s3://kunstmeile-app --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# never cache index.html (otherwise stale bundles get served)
aws s3 cp dist/index.html s3://kunstmeile-app/index.html \
  --cache-control "no-cache"
```

## Step 3: CloudFront distribution

1. Create a CloudFront distribution with the S3 bucket as **origin**.
2. Enable **Origin Access Control (OAC)** and apply the generated bucket policy
   so only CloudFront can read.
3. **Default Root Object:** `index.html`
4. **Viewer Protocol Policy:** *Redirect HTTP to HTTPS*

## Step 4: SPA fallback (important!)

Because React Router routes on the client, S3's 403/404 responses must redirect
to `index.html`. Under **CloudFront → Error Pages** add one entry each:

| HTTP Error Code | Response Page Path | HTTP Response Code |
|---|---|---|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

::: warning
Without these rules, opening a subpage directly (e.g. `/admin/events`) or
reloading results in an error.
:::

## Step 5: Update a deploy

On each new build, re-upload (step 2) and invalidate the CloudFront cache for
`index.html`:

```bash
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> --paths "/index.html"
```

## Step 6: Add the Supabase redirect URL

Add the CloudFront domain (or your own domain) in Supabase under
**Authentication → URL Configuration** as the **Site URL** / **Redirect URL** so
magic-link logins work.

::: tip Automation
Steps 1, 2 and 5 can be combined into a small deploy script or GitHub Actions
workflow (build → `s3 sync` → CloudFront invalidation).
:::

## Next steps

- Back to the [Vercel + Supabase guide](/en/installation/vercel-supabase)
- Other alternative: [Azure Static Web Apps](/en/installation/azure)
