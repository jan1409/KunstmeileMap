# Import & Export

Stände und Kategorien lassen sich per **CSV/Excel** im Stapel importieren und
exportieren. Zusätzlich kann eine komplette Veranstaltung als **ZIP** oder als
**statischer Web-Schnappschuss** exportiert werden.

## Stände importieren (CSV/Excel)

Der Import-Assistent (`/admin/events/:slug/tents/import`, **Editor**+) erstellt
viele Stände auf einmal:

![Import-Assistent mit Vorschau](/assets/screenshots/admin/import-wizard.png)

1. **Datei wählen** – `.csv` oder `.xlsx`.
2. Die Vorschau prüft jede Zeile und zeigt einen Status:
   - ✅ in Ordnung
   - ⚠️ Warnung (z. B. fehlende Koordinaten, unbekannter Kategorie-Slug,
     doppelter Slug)
   - ❌ Fehler (Zeile wird nicht importiert)
3. **Importieren** – alle gültigen Zeilen werden als neue Stände angelegt.

::: tip Vorlage nutzen
Eine vorbereitete Excel-Vorlage liegt im Repository unter
[`public/import-template.xlsx`](https://github.com/jan1409/KunstmeileMap/blob/main/public/import-template.xlsx)
und ist in der App verlinkt.
:::

### Spalten

| Spalte | Pflicht | Hinweis |
|---|---|---|
| `name` | ja | Standname |
| `slug` | nein | wird sonst aus dem Namen erzeugt |
| `contact_person` | nein | auch als `ansprechperson` erkannt |
| `description_de`, `description_en` | nein | Beschreibung |
| `address` | nein | Anschrift |
| `website_url`, `instagram_url`, `facebook_url`, `email_public` | nein | Links |
| `lat`, `lng` | nein | Koordinaten (beide oder keine) |
| `categories` | nein | Kategorie-Slugs, kommagetrennt |

::: info Spalten-Aliase
Überschriften werden ohne Groß-/Kleinschreibung erkannt, und für die
Ansprechperson sind `contact_person`, `ansprechperson` und `contact person`
gleichwertig.
:::

## Stände exportieren

In der [Standliste](/admin/tents) erzeugt **Export** eine Excel-/CSV-Datei mit
allen Standfeldern (Name, Slug, Ansprechperson, Beschreibungen, Adresse, Links,
Koordinaten, Kategorien). Ideal zum Sichern oder zur Weiterbearbeitung und zum
erneuten Re-Import.

## Kategorien importieren / exportieren

Analog auf der [Kategorien-Seite](/admin/categories): Export als Excel; Import
per CSV/Excel zum Anlegen oder Aktualisieren von Kategorien.

## Komplette Veranstaltung exportieren

In den [Einstellungen](/admin/events#einstellungen) der Veranstaltung
(**Owner**) stehen zwei Gesamt-Exporte zur Verfügung:

![Export-Funktionen](/assets/screenshots/admin/export-buttons.png)

### 1. Vollständiger ZIP-Export

Enthält alle Stände, **alle Fotos** und Metadaten (inkl. Einwilligungs-
Zeitstempel der Fotos). Ein Fortschrittsbalken zeigt den Verlauf. Ergebnis:
`kunstmeile-<slug>-export-<datum>.zip`. Geeignet als vollständige Sicherung.

### 2. Web-Schnappschuss (statisches HTML)

Erzeugt eine **eigenständige, offline lauffähige** HTML-Version der Karte
(inkl. Fotos), die ohne Supabase auskommt. Ergebnis:
`kunstmeile-<slug>-web-<datum>.zip`. Geeignet zur Archivierung oder zum
Verteilen einer fixen Momentaufnahme.

::: tip
Der Web-Schnappschuss eignet sich, um eine vergangene Veranstaltung dauerhaft
ohne laufendes Backend verfügbar zu halten – einfach das ZIP auf einem
beliebigen Webspace entpacken.
:::

## Weiter geht's

- [Stände verwalten](/admin/tents)
- [Kategorien verwalten](/admin/categories)
- [Fotos verwalten](/admin/photos)
