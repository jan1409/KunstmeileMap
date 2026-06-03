# Kategorien verwalten

**Kategorien** gliedern die Stände (z. B. *Kunst*, *Essen*, *Musik*). Besucher
filtern die Karte darüber, und die erste Kategorie eines Standes bestimmt seine
**Markerfarbe**. Kategorien gehören jeweils zu einer Veranstaltung.

> **Rolle:** Kategorien bearbeiten dürfen **Editor** und höher.

## Kategorienübersicht

Unter **Kategorien** (`/admin/events/:slug/categories`) erscheinen alle
Kategorien mit Slug, Namen (DE/EN), Symbol und Reihenfolge.

![Kategorienverwaltung](/assets/screenshots/admin/category-list.png)

## Kategorie anlegen oder bearbeiten

Über das Inline-Formular:

| Feld | Beschreibung |
|---|---|
| **Slug** *(Pflicht)* | Eindeutige Kennung in Kleinbuchstaben (z. B. `food`) |
| **Name (DE)** *(Pflicht)* | Anzeigename auf Deutsch |
| **Name (EN)** | Anzeigename auf Englisch |
| **Symbol** | Emoji als Icon für den Filter-Button (z. B. `🍕`, `🍺`, `🅿️`) |
| **Reihenfolge** | Zahl – steuert die Sortierung der Filter-Buttons |

::: tip
Die **Reihenfolge** (display_order) bestimmt, in welcher Abfolge die
Filter-Buttons für Besucher erscheinen. Niedrige Zahlen zuerst.
:::

## Massen-Import / -Export

Kategorien lassen sich auch per Datei pflegen:

- **Export:** lädt alle Kategorien als Excel-Datei (Slug, Namen, Symbol,
  Reihenfolge).
- **Import:** über das Import-Fenster eine CSV-/Excel-Datei hochladen, um
  Kategorien anzulegen oder zu aktualisieren.

Details zum Dateiformat: [Import & Export](/admin/import-export).

## Kategorie löschen

Über die Zeilen-Aktion mit Bestätigung. Stände, die nur dieser Kategorie
zugeordnet waren, verlieren entsprechend ihre Zuordnung.

## Weiter geht's

- [Stände den Kategorien zuordnen](/admin/tents)
- [Import & Export](/admin/import-export)
