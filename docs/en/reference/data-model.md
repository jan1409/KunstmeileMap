# Reference: Data Model

Overview of the most important tables in the Supabase database. The full schema
lives as migrations under `supabase/migrations/`.

## Tables

### `events`
Slug (unique), `title_de`/`title_en`, `year`, `status`
(`draft`/`published`/`archived`), `is_featured`, default map view
(`default_lat`, `default_lng`, `default_zoom`), `lightbox_full_size`,
`venue_name`, `venue_address`, `starts_at`/`ends_at`.

### `tents`
`event_id`, slug, `name`, `display_number`, `contact_person`,
`description_de`/`description_en`, `address`, `website_url`, `instagram_url`,
`facebook_url`, `email_public`, `marker_icon`, `lat`/`lng` (both or neither),
audit fields (`created_by`, `updated_by`, timestamps).

### `categories`
`event_id`, slug, `name_de`/`name_en`, `icon` (emoji), `display_order`.

### `tent_categories`
Junction table tent ↔ category (n:m).

### `tent_photos`
`tent_id`, `storage_path` (bucket `tent-photos`), `caption_de`/`caption_en`,
`display_order`, `uploaded_by`, `consent_recorded_at` (GDPR consent).

### `profiles`
`id` (= `auth.users.id`), `full_name`, global `role` (`admin`/`editor`).

### `event_admins`
`event_id` + `profile_id` + `role_in_event` (`owner`/`editor`/`contributor`).

## Enums

| Enum | Values |
|---|---|
| `event_status` | `draft`, `published`, `archived` |
| `event_role` | `owner`, `editor`, `contributor` |
| `user_role` | `admin`, `editor` |

## Key database functions (RPC)

| Function | Purpose |
|---|---|
| `duplicate_event(...)` | Clone an event incl. tents/positions/categories |
| `has_event_role(event_id, min_role)` | Role check |
| `get_event_permissions(event_id)` | Permissions of the current user |
| `get_event_users(event_id)` | Members of an event |
| `is_admin()` | Global admin? |

## Storage

Bucket **`tent-photos`** (public read, write only for editors/admins). Path
scheme: `tent-photos/<event_id>/<tent_id>/<file>`.

## See also

- [Events](/en/admin/events) · [Tents](/en/admin/tents) · [Photos](/en/admin/photos)
- [Users & Roles](/en/admin/users-roles)
