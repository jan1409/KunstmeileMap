# Referenz: Datenmodell

Überblick über die wichtigsten Tabellen in der Supabase-Datenbank. Das
vollständige Schema liegt als Migrationen unter `supabase/migrations/`.

## Tabellen

### `events` – Veranstaltungen
Slug (eindeutig), `title_de`/`title_en`, `year`, `status`
(`draft`/`published`/`archived`), `is_featured`, Karten-Standardansicht
(`default_lat`, `default_lng`, `default_zoom`), `lightbox_full_size`,
`venue_name`, `venue_address`, `starts_at`/`ends_at`.

### `tents` – Stände
`event_id`, Slug, `name`, `display_number`, `contact_person`,
`description_de`/`description_en`, `address`, `website_url`, `instagram_url`,
`facebook_url`, `email_public`, `marker_icon`, `lat`/`lng` (beide oder keine),
Audit-Felder (`created_by`, `updated_by`, Zeitstempel).

### `categories` – Kategorien
`event_id`, Slug, `name_de`/`name_en`, `icon` (Emoji), `color` (Hex-Markerfarbe
oder `null` für automatische Farbe), `display_order`.

### `tent_categories` – Zuordnung
Verknüpfungstabelle Stand ↔ Kategorie (n:m).

### `tent_photos` – Fotos
`tent_id`, `storage_path` (Bucket `tent-photos`), `caption_de`/`caption_en`,
`display_order`, `uploaded_by`, `consent_recorded_at` (DSGVO-Einwilligung).

### `profiles` – Benutzerprofile
`id` (= `auth.users.id`), `full_name`, globale `role` (`admin`/`editor`).

### `event_admins` – Rollen je Veranstaltung
`event_id` + `profile_id` + `role_in_event` (`owner`/`editor`/`contributor`).

## Enums

| Enum | Werte |
|---|---|
| `event_status` | `draft`, `published`, `archived` |
| `event_role` | `owner`, `editor`, `contributor` |
| `user_role` | `admin`, `editor` |

## Wichtige Datenbankfunktionen (RPC)

| Funktion | Zweck |
|---|---|
| `duplicate_event(...)` | Veranstaltung inkl. Ständen/Positionen/Kategorien klonen |
| `has_event_role(event_id, min_role)` | Rollenprüfung |
| `get_event_permissions(event_id)` | Berechtigungen des aktuellen Benutzers |
| `get_event_users(event_id)` | Mitglieder einer Veranstaltung |
| `is_admin()` | globaler Admin? |

## Storage

Bucket **`tent-photos`** (öffentlich lesbar, Schreibzugriff nur für Editoren/
Admins). Pfadschema: `tent-photos/<event_id>/<tent_id>/<datei>`.

## Siehe auch

- [Veranstaltungen](/admin/events) · [Stände](/admin/tents) · [Fotos](/admin/photos)
- [Benutzer & Rollen](/admin/users-roles)
