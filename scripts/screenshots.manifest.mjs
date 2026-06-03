// Single source of truth for every screenshot used in the documentation.
// Consumed by:
//   - scripts/gen-placeholders.mjs   (creates neutral placeholder PNGs)
//   - scripts/docs-screenshots.ts    (Playwright capture overwrites placeholders)
//
// `viewport`: 'desktop' (1440x900) or 'mobile' (390x844).
// `auth`: true means the capture flow must be logged in as an admin/owner.
// `path` is relative to docs/public/assets/screenshots/ and the same string is
// referenced from the Markdown pages, so keep names stable.

export const DESKTOP = { width: 1440, height: 900 }
export const MOBILE = { width: 390, height: 844 }

/** @type {{path: string, viewport: 'desktop'|'mobile', auth: boolean, caption: string}[]} */
export const SCREENSHOTS = [
  // ---- Public / visitor flows ----
  { path: 'user/map-overview.png', viewport: 'desktop', auth: false, caption: 'Kartenübersicht mit Standmarkern' },
  { path: 'user/map-satellite.png', viewport: 'desktop', auth: false, caption: 'Satelliten-Ansicht (Kartenstil-Umschalter)' },
  { path: 'user/marker-detail.png', viewport: 'desktop', auth: false, caption: 'Nummerierte Marker bei hohem Zoom' },
  { path: 'user/search-dropdown.png', viewport: 'desktop', auth: false, caption: 'Suche nach Name oder Ansprechperson' },
  { path: 'user/category-filter.png', viewport: 'desktop', auth: false, caption: 'Kategorie-Filter' },
  { path: 'user/side-panel.png', viewport: 'desktop', auth: false, caption: 'Detail-Seitenleiste eines Standes' },
  { path: 'user/photo-lightbox.png', viewport: 'desktop', auth: false, caption: 'Foto-Lightbox' },
  { path: 'user/desktop-overview.png', viewport: 'desktop', auth: false, caption: 'Gesamtansicht am Desktop' },
  { path: 'user/mobile-map.png', viewport: 'mobile', auth: false, caption: 'Karte auf dem Smartphone' },
  { path: 'user/mobile-drawer.png', viewport: 'mobile', auth: false, caption: 'Detail-Schublade (Bottom Sheet) mobil' },
  { path: 'user/mobile-menu.png', viewport: 'mobile', auth: false, caption: 'Mobiles Menü (Suche & Kategorien)' },

  // ---- Admin / organizer flows (require login) ----
  { path: 'admin/login.png', viewport: 'desktop', auth: false, caption: 'Admin-Anmeldung (Magic Link)' },
  { path: 'admin/dashboard.png', viewport: 'desktop', auth: true, caption: 'Admin-Dashboard' },
  { path: 'admin/event-list.png', viewport: 'desktop', auth: true, caption: 'Liste der Veranstaltungen' },
  { path: 'admin/event-settings.png', viewport: 'desktop', auth: true, caption: 'Veranstaltungs-Einstellungen' },
  { path: 'admin/event-duplicate.png', viewport: 'desktop', auth: true, caption: 'Veranstaltung duplizieren' },
  { path: 'admin/tent-list.png', viewport: 'desktop', auth: true, caption: 'Standliste' },
  { path: 'admin/tent-edit.png', viewport: 'desktop', auth: true, caption: 'Stand bearbeiten – Formular' },
  { path: 'admin/tent-map-editor.png', viewport: 'desktop', auth: true, caption: 'Standposition auf der Karte setzen' },
  { path: 'admin/category-list.png', viewport: 'desktop', auth: true, caption: 'Kategorienverwaltung' },
  { path: 'admin/import-wizard.png', viewport: 'desktop', auth: true, caption: 'Import-Assistent (CSV/Excel) mit Vorschau' },
  { path: 'admin/export-buttons.png', viewport: 'desktop', auth: true, caption: 'Export-Funktionen' },
  { path: 'admin/photos-grid.png', viewport: 'desktop', auth: true, caption: 'Foto-Verwaltung (Raster)' },
  { path: 'admin/photo-dropzone.png', viewport: 'desktop', auth: true, caption: 'Foto-Upload per Drag & Drop (Desktop)' },
  { path: 'admin/positions-editor.png', viewport: 'desktop', auth: true, caption: 'Positions-Editor (Stapelbearbeitung)' },
  { path: 'admin/users-page.png', viewport: 'desktop', auth: true, caption: 'Benutzer- und Rollenverwaltung' },
  { path: 'admin/invite-user.png', viewport: 'desktop', auth: true, caption: 'Benutzer einladen' },
]
