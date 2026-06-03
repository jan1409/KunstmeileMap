# Stände (Tents) verwalten

Ein **Stand** (im Code: *Tent*) ist ein Ausstellungs- oder Verkaufspunkt auf der
Karte – mit Name, Beschreibung, Kontakt, Kategorien, Fotos und einer Position.

> **Rolle:** Stände ansehen/bearbeiten dürfen **Contributor** und höher; neue
> Stände anlegen **Editor** und höher.

## Standliste

Unter **Stände** (`/admin/events/:slug/tents`) erscheinen alle Stände der
Veranstaltung mit Name, Standnummer und Zeitstempeln.

![Standliste](/assets/screenshots/admin/tent-list.png)

Von hier aus: neuen Stand anlegen, bearbeiten, löschen sowie
[importieren/exportieren](/admin/import-export).

## Neuen Stand anlegen

**Neuer Stand** öffnet das Formular (`/admin/events/:slug/tents/new`):

![Stand bearbeiten – Formular](/assets/screenshots/admin/tent-edit.png)

### Felder

| Feld | Beschreibung |
|---|---|
| **Name** *(Pflicht)* | Anzeigename des Standes |
| **Slug** *(Pflicht)* | URL-Kennung (Kleinbuchstaben/Ziffern), automatisch aus dem Namen vorgeschlagen |
| **Standnummer** | Wird auf dem Kartenmarker angezeigt; automatisch vergeben oder manuell |
| **Ansprechperson** | Name des Kontakts (auch durchsuchbar) |
| **Beschreibung (DE/EN)** | Zweisprachiger Beschreibungstext |
| **Adresse** | Anschrift des Standes |
| **Website / Instagram / Facebook / E-Mail** | Verlinkungen (werden validiert) |
| **Marker-Symbol** | Optionales Symbol (Essen/Trinken/Parken) statt der Nummer |
| **Kategorien** | Mehrfachauswahl; die erste Kategorie bestimmt die Markerfarbe |

::: tip Marker-Symbole
Für Essens-/Getränke-/Servicestände kann ein Symbol (z. B. 🍔 Burger, 🍺 Bier,
☕ Kaffee, 🅿️ Parken) gewählt werden. Es ersetzt die Nummer auf der Karte und
hilft Besuchern bei der Orientierung.
:::

## Position auf der Karte setzen

Im Stand-Formular ist ein interaktiver Karteneditor eingebettet:

![Standposition auf der Karte setzen](/assets/screenshots/admin/tent-map-editor.png)

1. Auf die Karte klicken, um den Marker zu setzen (oder den Marker ziehen).
2. Bereits platzierte Stände erscheinen als **grüne** Kontextmarker – so lassen
   sich Überschneidungen vermeiden.
3. Zwischen **Straßenkarte (OSM)** und **Satellit** umschalten.
4. Die aktuellen Koordinaten werden angezeigt und beim Speichern übernommen.

::: info Stände ohne Position
Ein Stand kann auch ohne Koordinaten gespeichert werden – er erscheint dann
nicht auf der Karte. Besucher werden über ein Banner darauf hingewiesen. Mehrere
Stände lassen sich effizient im [Positions-Editor](#positionen-im-stapel-setzen)
platzieren.
:::

## Positionen im Stapel setzen

Sollen viele Stände nacheinander platziert werden, ist der **Positions-Editor**
(`/admin/events/:slug/positions`) effizienter als das Einzelformular:

![Positions-Editor](/assets/screenshots/admin/positions-editor.png)

1. Links die Liste der noch nicht platzierten Stände – einen auswählen.
2. Auf der Karte den Punkt setzen oder vorhandene Marker verschieben.
3. Alle Änderungen werden gesammelt und mit **Speichern** auf einmal übernommen.
   Ungespeicherte Änderungen werden vor dem Verlassen gemeldet.

## Stand löschen

In der Standliste über die Zeilen-Aktion löschen (mit Bestätigung). Zum Leeren
einer kompletten Veranstaltung gibt es zusätzlich einen **Massen-Löschen**-
Vorgang, bei dem zur Sicherheit der Veranstaltungs-Slug eingetippt werden muss.

## Weiter geht's

- [Fotos zu Ständen hinzufügen](/admin/photos)
- [Kategorien verwalten](/admin/categories)
- [Stände per CSV/Excel importieren](/admin/import-export)
