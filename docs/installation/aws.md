# Alternative: AWS S3 + CloudFront

Auch auf AWS lässt sich die KunstmeileMap als statische Single-Page-App
betreiben: **S3** speichert die Dateien, **CloudFront** liefert sie weltweit
mit HTTPS aus. Das Backend bleibt **Supabase**.

::: info Was bleibt gleich?
Supabase (Datenbank, Auth, Storage, Edge Function `invite-user`) wird wie in der
[Vercel-Anleitung](/installation/vercel-supabase) eingerichtet (Schritte 1–5).
Diese Seite ersetzt nur das Hosting.
:::

## Voraussetzungen

- Supabase ist bereits eingerichtet.
- Ein **AWS**-Konto und die **AWS CLI** (`aws configure`).
- Die App ist lokal baubar (`pnpm build` erzeugt `dist/`).

## Schritt 1: Produktions-Build erzeugen

Die `VITE_*`-Variablen müssen beim Build gesetzt sein (in `.env.local` oder als
Shell-Variablen):

```bash
pnpm install
pnpm build      # erzeugt dist/
```

## Schritt 2: S3-Bucket anlegen

```bash
aws s3 mb s3://kunstmeile-app --region eu-central-1
```

Den Bucket **nicht** öffentlich machen – der Zugriff läuft ausschließlich über
CloudFront (Origin Access Control). Inhalte hochladen:

```bash
# gehashte Assets lange cachen
aws s3 sync dist/ s3://kunstmeile-app --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# index.html nie cachen (sonst werden alte Bundles ausgeliefert)
aws s3 cp dist/index.html s3://kunstmeile-app/index.html \
  --cache-control "no-cache"
```

## Schritt 3: CloudFront-Distribution

1. Eine CloudFront-Distribution mit dem S3-Bucket als **Origin** erstellen.
2. **Origin Access Control (OAC)** aktivieren und die generierte Bucket-Policy
   übernehmen, damit nur CloudFront lesen darf.
3. **Default Root Object:** `index.html`
4. **Viewer Protocol Policy:** *Redirect HTTP to HTTPS*

## Schritt 4: SPA-Fallback (wichtig!)

Da React Router clientseitig routet, müssen 403/404-Antworten von S3 auf
`index.html` umgeleitet werden. Unter **CloudFront → Error Pages** je einen
Eintrag anlegen:

| HTTP Error Code | Response Page Path | HTTP Response Code |
|---|---|---|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

::: warning
Ohne diese Regeln führt das direkte Aufrufen einer Unterseite
(z. B. `/admin/events`) oder ein Reload zu einem Fehler.
:::

## Schritt 5: Deploy aktualisieren

Bei jedem neuen Build erneut hochladen (Schritt 2) und den CloudFront-Cache für
`index.html` invalidieren:

```bash
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> --paths "/index.html"
```

## Schritt 6: Supabase-Redirect-URL ergänzen

Die CloudFront-Domain (bzw. eigene Domain) in Supabase unter
**Authentication → URL Configuration** als **Site URL** / **Redirect URL**
eintragen, damit Magic-Link-Logins funktionieren.

::: tip Automatisierung
Schritte 1, 2 und 5 lassen sich als kleines Deploy-Skript oder GitHub-Actions-
Workflow zusammenfassen (build → `s3 sync` → CloudFront-Invalidation).
:::

## Weiter geht's

- Zurück zur [Vercel + Supabase-Anleitung](/installation/vercel-supabase)
- Andere Alternative: [Azure Static Web Apps](/installation/azure)
