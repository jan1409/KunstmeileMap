# Referenz: Umgebungsvariablen

Die App liest ihre Konfiguration aus `VITE_*`-Umgebungsvariablen. Lokal stehen
sie in `.env.local` (Vorlage: `.env.example`), im Betrieb in den Projekt-
Einstellungen des Hosters (z. B. Vercel).

::: warning Build-Zeit-Werte
Alle `VITE_*`-Variablen werden beim **Build** fest in das JavaScript-Bundle
geschrieben. Änderungen wirken erst nach einem **neuen Build/Deploy** – ein
Ändern zur Laufzeit ist nicht möglich.
:::

## Erforderliche Variablen

| Variable | Zweck | Beispiel |
|---|---|---|
| `VITE_SUPABASE_URL` | URL des Supabase-Projekts | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Öffentlicher „anon"-API-Key von Supabase | `eyJhbGci…` (JWT) |
| `VITE_DEFAULT_EVENT_SLUG` | Veranstaltung, die unter `/` (ohne Slug) geladen wird | `kunstmeile-2026` |

## Weitere Variablen

| Variable | Zweck |
|---|---|
| `VITE_SNAPSHOT` | Bei `1` läuft das Viewer-Bundle im **Offline-Modus** und liest eingebettete Daten statt Supabase. Wird vom Web-Schnappschuss-Build (`vite.viewer.config.ts`) gesetzt – im Normalbetrieb nicht nötig. |

## `.env.example`

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DEFAULT_EVENT_SLUG=kunstmeile-2026
```

::: tip Sicherheit
Der **anon key** ist für den Client-Einsatz vorgesehen und öffentlich – der
Datenschutz wird durch die Row-Level-Security-Regeln in der Datenbank
sichergestellt. Der **Service-Role-Key** gehört **niemals** in die Web-App; er
wird ausschließlich serverseitig in der Edge Function `invite-user` verwendet
(von Supabase automatisch injiziert).
:::

## Siehe auch

- [Installation: Vercel + Supabase](/installation/vercel-supabase)
- [Fehlerbehebung](/reference/troubleshooting)
