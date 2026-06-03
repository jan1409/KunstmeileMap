# Referenz: Fehlerbehebung

Häufige Probleme und ihre Lösung.

## Die App lädt, zeigt aber keine Karte / keine Stände

- **Veranstaltung nicht veröffentlicht:** Nur Veranstaltungen im Status
  *published* sind öffentlich sichtbar. Status in den
  [Einstellungen](/admin/events#status-sichtbarkeit) prüfen.
- **Falscher Default-Slug:** `VITE_DEFAULT_EVENT_SLUG` muss exakt dem Slug einer
  veröffentlichten Veranstaltung entsprechen. Nach Änderung **neu deployen**.
- **Stände ohne Koordinaten:** Stände ohne `lat`/`lng` erscheinen nicht auf der
  Karte (Hinweis-Banner beachten). Positionen im
  [Positions-Editor](/admin/tents#positionen-im-stapel-setzen) setzen.

## Magic-Link-Login funktioniert nicht

- **Site/Redirect-URL fehlt:** In Supabase unter
  **Authentication → URL Configuration** die Produktiv-Domain als *Site URL* und
  alle Vorschau-Domains als *Redirect URLs* eintragen.
- **Link abgelaufen:** Magic Links sind nur kurz gültig – neuen anfordern.

## „Kein Zugriff" nach dem Login

Der Benutzer ist angemeldet, aber keiner Veranstaltung zugeordnet. Ein **Owner**
oder globaler Admin muss ihn [einladen](/admin/users-roles#benutzer-einladen).

## Unterseite / Reload führt zu 404

Die SPA-Fallback-Regel fehlt beim Hoster:

- **Vercel:** `vercel.json` mit Rewrite auf `/index.html` ist vorhanden.
- **Azure:** `staticwebapp.config.json` mit `navigationFallback` – siehe
  [Azure-Anleitung](/installation/azure#schritt-1-spa-fallback-konfigurieren).
- **AWS:** CloudFront-Error-Pages 403/404 → `/index.html` (200) – siehe
  [AWS-Anleitung](/installation/aws#schritt-4-spa-fallback-wichtig).

## Änderung der Supabase-Zugangsdaten wirkt nicht

`VITE_*`-Variablen werden zur **Build-Zeit** eingebaut. Nach jeder Änderung ein
**neues Deploy / Re-Build** auslösen.

## Bilder werden nicht angezeigt / Upload schlägt fehl

- **Bucket fehlt:** Der Bucket `tent-photos` wird durch die Migrationen angelegt
  (`supabase db push`). Prüfen, ob alle Migrationen eingespielt sind.
- **Drag & Drop am Smartphone:** Die Drop-Zone ist nur am Desktop aktiv; mobil
  den Kamera-/Galerie-Upload nutzen (siehe [Fotos](/admin/photos)).

## CLI / Migrationen

- `supabase db push` schlägt fehl → zuerst `supabase link --project-ref <ref>`
  ausführen und sicherstellen, dass die CLI angemeldet ist (`supabase login`).
- Unter **Windows/PowerShell** beim Erzeugen von Typdateien auf die Ausgabe-
  Umleitung achten (`>` schreibt UTF‑16; ggf. die Datei als UTF‑8 prüfen).

## Siehe auch

- [Umgebungsvariablen](/reference/env-vars)
- [Installation: Vercel + Supabase](/installation/vercel-supabase)
