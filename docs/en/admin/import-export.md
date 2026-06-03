# Import & Export

Tents and categories can be imported and exported in bulk via **CSV/Excel**. In
addition, a whole event can be exported as a **ZIP** or as a **static web
snapshot**.

## Import tents (CSV/Excel)

The import wizard (`/admin/events/:slug/tents/import`, **Editor**+) creates many
tents at once:

![Import wizard with preview](/assets/screenshots/admin/import-wizard.png)

1. **Choose a file** – `.csv` or `.xlsx`.
2. The preview checks each row and shows a status:
   - ✅ ok
   - ⚠️ warning (e.g. missing coordinates, unknown category slug, duplicate slug)
   - ❌ error (row is not imported)
3. **Import** – all valid rows are created as new tents.

::: tip Use the template
A prepared Excel template lives in the repository at
[`public/import-template.xlsx`](https://github.com/jan1409/KunstmeileMap/blob/main/public/import-template.xlsx)
and is linked in the app.
:::

### Columns

| Column | Required | Note |
|---|---|---|
| `name` | yes | Tent name |
| `slug` | no | otherwise generated from the name |
| `contact_person` | no | also recognized as `ansprechperson` |
| `description_de`, `description_en` | no | Description |
| `address` | no | Address |
| `website_url`, `instagram_url`, `facebook_url`, `email_public` | no | Links |
| `lat`, `lng` | no | Coordinates (both or neither) |
| `categories` | no | Category slugs, comma-separated |

::: info Column aliases
Headers are recognized case-insensitively, and for the contact person
`contact_person`, `ansprechperson` and `contact person` are equivalent.
:::

## Export tents

In the [tent list](/en/admin/tents), **Export** produces an Excel/CSV file with
all tent fields (name, slug, contact person, descriptions, address, links,
coordinates, categories). Ideal for backups, further editing and re-import.

## Import / export categories

Likewise on the [Categories page](/en/admin/categories): export as Excel; import
via CSV/Excel to create or update categories.

## Export an entire event

In the event's [settings](/en/admin/events#settings) (**Owner**) two full
exports are available:

![Export functions](/assets/screenshots/admin/export-buttons.png)

### 1. Full ZIP export

Contains all tents, **all photos** and metadata (including the photos' consent
timestamps). A progress bar shows the status. Result:
`kunstmeile-<slug>-export-<date>.zip`. Suitable as a complete backup.

### 2. Web snapshot (static HTML)

Produces a **self-contained, offline-capable** HTML version of the map
(including photos) that needs no Supabase. Result:
`kunstmeile-<slug>-web-<date>.zip`. Suitable for archiving or distributing a
fixed snapshot.

::: tip
The web snapshot is useful to keep a past event permanently available without a
running backend – just unzip it onto any web space.
:::

## Next steps

- [Manage tents](/en/admin/tents)
- [Manage categories](/en/admin/categories)
- [Manage photos](/en/admin/photos)
