# Alternative: Azure Static Web Apps

KunstmeileMap is a purely static single-page app. The backend (Supabase) stays
unchanged – only the **hosting of the web app** moves from Vercel to **Azure
Static Web Apps**.

::: info What stays the same?
Supabase (database, auth, storage, the `invite-user` edge function) is set up
exactly as in the [Vercel guide](/en/installation/vercel-supabase). This page
only replaces steps 6–7 (hosting).
:::

## Prerequisites

- Supabase is already set up (steps 1–5 of the
  [Vercel guide](/en/installation/vercel-supabase)).
- An **Azure** account with an active subscription.
- Optionally the **Azure CLI** (`az`) or the **SWA CLI**
  (`npm install -g @azure/static-web-apps-cli`).

## Step 1: Configure the SPA fallback

So Azure passes unknown paths (e.g. `/admin/events`) to the SPA, add a
`staticwebapp.config.json` in the project root:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "*.{png,jpg,svg,ico,splat,xlsx}"]
  }
}
```

Azure copies this file automatically from the build output directory.

## Step 2: Create the Static Web App (portal)

1. In the [Azure portal](https://portal.azure.com): **Create a resource →
   Static Web App**.
2. Choose **Deployment source: GitHub** and connect the repository.
3. Build details:
   - **Build Presets:** *Custom*
   - **App location:** `/`
   - **Output location:** `dist`
4. Azure creates a GitHub Actions workflow that builds and deploys on every push.

## Step 3: Build command & environment variables

::: warning Env variables must be set at build time
The `VITE_*` values are compiled into the bundle at build time. With Azure Static
Web Apps, app settings are **not automatically** injected into the build step –
they must be available as `env` in the GitHub Actions workflow.
:::

In the generated workflow (`.github/workflows/azure-static-web-apps-*.yml`)
extend the build step with the variables and store them as **GitHub Secrets**:

```yaml
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_DEFAULT_EVENT_SLUG: ${{ secrets.VITE_DEFAULT_EVENT_SLUG }}
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "upload"
          app_location: "/"
          output_location: "dist"
          app_build_command: "pnpm build"
```

## Step 4: Add the Supabase redirect URL

Add the Azure domain (e.g. `https://<name>.azurestaticapps.net` or your own
domain) in Supabase under **Authentication → URL Configuration** as the
**Site URL** / **Redirect URL** so magic-link logins work.

## Alternative: deploy without GitHub (SWA CLI)

For manual deploys without GitHub Actions:

```bash
# build locally (with VITE_* set in the shell or .env.local)
pnpm build

# upload directly
swa deploy ./dist --env production
```

## Next steps

- Back to the [Vercel + Supabase guide](/en/installation/vercel-supabase)
- Other alternative: [AWS S3 + CloudFront](/en/installation/aws)
