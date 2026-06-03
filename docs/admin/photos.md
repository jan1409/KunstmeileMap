# Fotos verwalten

Jeder Stand kann mehrere **Fotos** haben, die Besucher in einer Lightbox ansehen
können. Fotos werden im Stand-Formular verwaltet.

> **Rolle:** Fotos hochladen/verwalten dürfen **Contributor** und höher.

## Foto-Raster

Im [Stand-Formular](/admin/tents) zeigt der Fotobereich alle vorhandenen Bilder
als Raster:

![Foto-Verwaltung (Raster)](/assets/screenshots/admin/photos-grid.png)

Pro Foto möglich:

- **Reihenfolge ändern** – per Ziehen innerhalb des Rasters (bestimmt die
  Anzeigereihenfolge in der Lightbox).
- **Drehen** – 90°-Schritte (praktisch für Hochkant-Handyfotos).
- **Löschen**.

## Hochladen am Desktop (Drag & Drop)

Am Desktop können Bilder per **Drag & Drop** in die Upload-Zone gezogen werden:

![Foto-Upload per Drag & Drop](/assets/screenshots/admin/photo-dropzone.png)

Alternativ öffnet ein Klick den Datei-Dialog. Mehrere Dateien gleichzeitig sind
möglich.

::: warning Nur am Desktop
Die Drag-&-Drop-Upload-Zone ist auf Mobilgeräten/Tablets deaktiviert. Dort steht
stattdessen der direkte Kamera-/Galerie-Upload zur Verfügung (siehe unten).
:::

## Hochladen auf dem Smartphone

Auf der **öffentlichen** Stand-Ansicht gibt es (für Berechtigte) einen
**Foto hinzufügen**-Knopf, der auf dem Smartphone direkt die **Kamera** öffnet
(`capture="environment"`) oder die Galerie. So lassen sich Fotos direkt vor Ort
aufnehmen.

## Bildqualität & Lightbox

Beim Upload werden Vorschau-Varianten erzeugt. Ob Besucher in der Lightbox die
**Vollauflösung** oder nur eine komprimierte Vorschau sehen, steuert die
Einstellung **`lightbox_full_size`** in den
[Veranstaltungs-Einstellungen](/admin/events#einstellungen).

## Einwilligung (DSGVO)

Beim Hochladen wird ein **Einwilligungs-Zeitstempel** (`consent_recorded_at`)
gespeichert. Damit ist dokumentiert, dass die Zustimmung zur Veröffentlichung
des Fotos vorlag. Diese Information ist auch im
[ZIP-Export](/admin/import-export#_1-vollstandiger-zip-export) enthalten.

::: tip
Vor dem Hochladen sicherstellen, dass für abgebildete Personen die nötige
Einwilligung vorliegt – die Verantwortung dafür liegt beim Veranstalter.
:::

## Weiter geht's

- [Stände verwalten](/admin/tents)
- [Veranstaltungs-Einstellungen](/admin/events#einstellungen)
