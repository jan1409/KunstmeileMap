# Alternative: Azure Static Web Apps

Die KunstmeileMap ist eine rein statische Single-Page-App. Das Backend
(Supabase) bleibt unverändert – nur das **Hosting der Web-App** wechselt von
Vercel zu **Azure Static Web Apps**.

::: info Was bleibt gleich?
Supabase (Datenbank, Auth, Storage, Edge Function `invite-user`) wird genau wie
in der [Vercel-Anleitung](/installation/vercel-supabase) eingerichtet. Diese
Seite ersetzt nur die Schritte 6–7 (Hosting).
:::

## Voraussetzungen

- Supabase ist bereits eingerichtet (Schritte 1–5 der
  [Vercel-Anleitung](/installation/vercel-supabase)).
- Ein **Azure**-Konto mit aktivem Abonnement.
- Optional die **Azure CLI** (`az`) bzw. die **SWA CLI**
  (`npm install -g @azure/static-web-apps-cli`).

## Schritt 1: SPA-Fallback konfigurieren

Damit Azure unbekannte Pfade (z. B. `/admin/events`) an die SPA übergibt, wird
eine Datei `staticwebapp.config.json` im Projekt-Root benötigt:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "*.{png,jpg,svg,ico,splat,xlsx}"]
  }
}
```

Azure kopiert diese Datei automatisch aus dem Build-Output-Verzeichnis.

## Schritt 2: Static Web App erstellen (Portal)

1. Im [Azure-Portal](https://portal.azure.com) **Create a resource → Static Web App**.
2. **Deployment source: GitHub** wählen und das Repository verbinden.
3. Build-Details:
   - **Build Presets:** *Custom*
   - **App location:** `/`
   - **Output location:** `dist`
4. Azure legt automatisch einen GitHub-Actions-Workflow an, der bei jedem Push
   baut und deployt.

## Schritt 3: Build-Befehl & Umgebungsvariablen

::: warning Env-Variablen müssen zur Build-Zeit gesetzt sein
Die `VITE_*`-Werte werden beim Build in das Bundle kompiliert. Bei Azure Static
Web Apps werden **App-Settings nicht automatisch** in den Build-Schritt injiziert
– sie müssen im GitHub-Actions-Workflow als `env` verfügbar sein.
:::

Im generierten Workflow (`.github/workflows/azure-static-web-apps-*.yml`) den
Build-Schritt um die Variablen ergänzen und sie als **GitHub Secrets** hinterlegen:

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

## Schritt 4: Supabase-Redirect-URL ergänzen

Die Azure-Domain (z. B. `https://<name>.azurestaticapps.net` bzw. die eigene
Domain) in Supabase unter **Authentication → URL Configuration** als
**Site URL** / **Redirect URL** eintragen, damit Magic-Link-Logins funktionieren.

## Alternative: Deploy ohne GitHub (SWA CLI)

Für manuelle Deploys ohne GitHub Actions:

```bash
# lokal bauen (mit gesetzten VITE_* in der Shell oder .env.local)
pnpm build

# direkt hochladen
swa deploy ./dist --env production
```

## Weiter geht's

- Zurück zur [Vercel + Supabase-Anleitung](/installation/vercel-supabase)
- Andere Alternative: [AWS S3 + CloudFront](/installation/aws)
