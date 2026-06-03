# Veranstaltungen verwalten

Eine **Veranstaltung** (Event) ist die oberste Einheit: Jede Kunstmeile-Ausgabe
ist eine eigene Veranstaltung mit eigenen Ständen, Kategorien und Fotos. Diese
Seite beschreibt das Anlegen, Duplizieren und Konfigurieren von Veranstaltungen.

> **Rolle:** Veranstaltungen anlegen können globale Admins; Einstellungen ändern
> kann der **Owner** der Veranstaltung. Siehe [Benutzer & Rollen](/admin/users-roles).

## Veranstaltungsübersicht

Unter **Admin → Veranstaltungen** (`/admin/events`) erscheinen alle
Veranstaltungen mit Slug, Titel, Jahr, Status und Featured-Markierung.

![Liste der Veranstaltungen](/assets/screenshots/admin/event-list.png)

Pro Zeile führen die Aktionen direkt zu Ständen, Positionen, Kategorien,
Einstellungen und Benutzern.

## Neue Veranstaltung anlegen

1. In der Übersicht auf **Neue Veranstaltung** klicken.
2. Pflichtangaben ausfüllen:
   - **Slug** – eindeutige URL-Kennung (Kleinbuchstaben, z. B. `kunstmeile-2026`)
   - **Titel (DE)** und optional **Titel (EN)**
   - **Jahr**
3. Speichern. Die Veranstaltung startet im Status **Entwurf** (draft).

## Status & Sichtbarkeit

| Status | Bedeutung |
|---|---|
| **draft** (Entwurf) | Nur für angemeldete Bearbeiter sichtbar |
| **published** (veröffentlicht) | Öffentlich auf der Karte sichtbar |
| **archived** (archiviert) | Nicht mehr öffentlich, bleibt erhalten |

Damit eine Veranstaltung auf der öffentlichen Startseite (`/`) erscheint, muss
sie **veröffentlicht** sein und ihr Slug als `VITE_DEFAULT_EVENT_SLUG` gesetzt
sein (siehe [Umgebungsvariablen](/reference/env-vars)). Mit **Featured** wird die
hervorgehobene Standard-Veranstaltung markiert.

## Einstellungen

Unter **Einstellungen** (`/admin/events/:slug/settings`, nur Owner) lassen sich
konfigurieren:

![Veranstaltungs-Einstellungen](/assets/screenshots/admin/event-settings.png)

- **Basisdaten:** Titel (DE/EN), Jahr, Status, Featured, Start-/Enddatum
- **Karten-Standardansicht:** `default_lat`, `default_lng`, `default_zoom` –
  bestimmt den Bildausschnitt beim Öffnen der Karte
- **Foto-Lightbox:** `lightbox_full_size` – Vollauflösung im Großbild oder nur
  komprimierte Vorschau (siehe [Fotos](/admin/photos))
- **Veranstaltungsort:** `venue_name`, `venue_address` (interne Referenz)
- **Export-Funktionen** (siehe [Import & Export](/admin/import-export))

::: tip Karten-Standardansicht schnell bestimmen
Den gewünschten Ausschnitt auf der öffentlichen Karte einstellen, Breitengrad/
Längengrad und Zoom ablesen und hier eintragen.
:::

## Veranstaltung duplizieren

Für eine neue Ausgabe muss nichts von Hand neu angelegt werden – eine bestehende
Veranstaltung lässt sich klonen:

![Veranstaltung duplizieren](/assets/screenshots/admin/event-duplicate.png)

1. In der Übersicht auf **Duplizieren** klicken.
2. Neuen **Titel**, **Slug** und **Jahr** angeben.
3. Auswählen, was übernommen wird: **Stände**, **Positionen**, **Kategorien**.
4. Bestätigen – die neue Veranstaltung wird als Entwurf erstellt.

## Weiter geht's

- [Kategorien anlegen](/admin/categories)
- [Stände anlegen](/admin/tents)
- [Daten importieren/exportieren](/admin/import-export)
