# Installation: Vercel + Supabase

Diese Anleitung führt Schritt für Schritt durch das Aufsetzen der KunstmeileMap
mit **Supabase** als Backend (Datenbank, Auth, Datei-Speicher) und **Vercel** als
Hosting für die Web-App. Das ist der empfohlene Standard-Weg.

::: info Architektur in einem Satz
Die App ist eine rein statische Single-Page-App (React + Vite). Das gesamte
Backend läuft serverlos über Supabase – es wird **kein eigener Server** benötigt.
:::

## Voraussetzungen

- **Node.js ≥ 20** und **pnpm** (`npm install -g pnpm`)
- Ein **Supabase**-Konto → [supabase.com](https://supabase.com)
- Ein **Vercel**-Konto → [vercel.com](https://vercel.com)
- Die **Supabase CLI** (`npm install -g supabase`)
- Das Repository lokal geklont:

```bash
git clone https://github.com/jpoepke/KunstmeileMap.git
cd KunstmeileMap
pnpm install
```

## Schritt 1: Supabase-Projekt anlegen

1. In [app.supabase.com](https://app.supabase.com) ein neues Projekt erstellen
   (Region möglichst nah an den Besuchern, z. B. *Frankfurt / eu-central*).
2. Ein Datenbank-Passwort vergeben und sicher speichern.
3. Unter **Project Settings → API** die folgenden Werte notieren:
   - **Project URL** → wird zu `VITE_SUPABASE_URL`
   - **anon public key** → wird zu `VITE_SUPABASE_ANON_KEY`

## Schritt 2: Datenbank-Schema einspielen

Das Schema, die Row-Level-Security-Regeln, der `tent-photos`-Storage-Bucket und
alle Hilfsfunktionen liegen als Migrationen unter `supabase/migrations/`.
Sie werden mit der CLI eingespielt:

```bash
# Projekt mit der CLI verknüpfen (Project-Ref aus der Supabase-URL)
pnpm supabase link --project-ref <project-ref>

# Alle Migrationen in das Cloud-Projekt schreiben
pnpm supabase db push
```

::: tip
`db push` legt automatisch alle Tabellen (`events`, `tents`, `categories`,
`tent_photos`, `profiles`, `event_admins`), Enums, RLS-Policies und den
öffentlichen Storage-Bucket `tent-photos` an. Ein separates Seed-Skript ist für
den Produktivbetrieb **nicht** nötig – Inhalte werden später über den
Admin-Bereich angelegt.
:::

Optional, für TypeScript-Typen passend zum eigenen Projekt:

```bash
pnpm types:gen   # schreibt src/types/supabase.ts
```

## Schritt 3: Edge Function `invite-user` deployen

Das Einladen von Benutzern läuft über eine Supabase Edge Function (Deno):

```bash
pnpm supabase functions deploy invite-user
```

Die CLI lädt die Funktion in das verknüpfte Projekt und injiziert den
`SUPABASE_SERVICE_ROLE_KEY` automatisch – es ist **keine** manuelle
Env-Variablen-Konfiguration nötig. Details: siehe
`supabase/functions/invite-user/README.md` im Repository.

## Schritt 4: E-Mail / Auth konfigurieren

Die Anmeldung im Admin-Bereich erfolgt per **Magic Link** (E-Mail).

1. In Supabase unter **Authentication → URL Configuration** die **Site URL** auf
   die spätere Produktiv-Domain setzen (z. B. `https://kunstmeile.example.com`).
2. Dort auch die Vercel-Preview-Domains als **Redirect URLs** hinterlegen, falls
   Vorschau-Deployments genutzt werden.

::: warning
Ohne korrekte Site/Redirect-URL führen Magic Links nach dem Klick ins Leere.
:::

## Schritt 5: Umgebungsvariablen lokal setzen

Für die lokale Entwicklung:

```bash
cp .env.example .env.local
```

Dann `.env.local` ausfüllen:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
VITE_DEFAULT_EVENT_SLUG=kunstmeile-2026
```

`VITE_DEFAULT_EVENT_SLUG` bestimmt, welche Veranstaltung beim Aufruf ohne
expliziten Slug (`/`) geladen wird. Lokal testen:

```bash
pnpm dev      # http://localhost:5173
```

Eine vollständige Übersicht aller Variablen gibt es in der
[Referenz: Umgebungsvariablen](/reference/env-vars).

## Schritt 6: Auf Vercel deployen

1. In Vercel **Add New → Project** wählen und das GitHub-Repository importieren.
2. Vercel erkennt Vite automatisch. Falls nicht:
   - **Build Command:** `pnpm build`
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install`
3. Unter **Settings → Environment Variables** die drei `VITE_*`-Variablen aus
   Schritt 5 mit den **Produktiv**-Werten eintragen (für *Production* und
   optional *Preview*).
4. **Deploy** klicken.

Das SPA-Routing ist bereits über `vercel.json` konfiguriert – alle Routen werden
auf `index.html` umgeschrieben, damit React Router clientseitig übernimmt:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

::: warning Env-Variablen sind „Build-Zeit"-Werte
Die `VITE_*`-Werte werden beim Build fest in das JavaScript eingebaut. Ein
Ändern der Supabase-Zugangsdaten erfordert einen **neuen Deploy / Re-Build** –
es genügt nicht, die Variable nur zu aktualisieren.
:::

## Schritt 7: Erste Veranstaltung anlegen

Nach dem Deploy:

1. `https://<deine-domain>/admin/login` öffnen und per Magic Link anmelden.
   (Der erste Benutzer muss als globaler Admin angelegt werden – siehe
   [Benutzer & Rollen](/admin/users-roles).)
2. Eine Veranstaltung erstellen und veröffentlichen – siehe
   [Veranstaltungen verwalten](/admin/events).
3. Den Slug dieser Veranstaltung als `VITE_DEFAULT_EVENT_SLUG` setzen (Vercel),
   damit sie auf der Startseite erscheint, und neu deployen.

## Weiter geht's

- [Veranstaltungen verwalten](/admin/events)
- [Stände anlegen](/admin/tents)
- Alternative Hostings: [Azure](/installation/azure) · [AWS](/installation/aws)
