# Managing categories

**Categories** group the tents (e.g. *Art*, *Food*, *Music*). Visitors filter the
map by them, and a tent's first category determines its **marker color**.
Categories belong to a single event.

> **Role:** **Editor** and above can edit categories.

## Category overview

Under **Categories** (`/admin/events/:slug/categories`) all categories appear
with slug, names (DE/EN), icon and order.

![Category management](/assets/screenshots/admin/category-list.png)

## Create or edit a category

Via the inline form:

| Field | Description |
|---|---|
| **Slug** *(required)* | Unique lowercase identifier (e.g. `food`) |
| **Name (DE)** *(required)* | German display name |
| **Name (EN)** | English display name |
| **Icon** | Emoji icon for the filter button (e.g. `🍕`, `🍺`, `🅿️`) |
| **Order** | Number – controls the sort order of the filter buttons |

::: tip
**Order** (display_order) determines the sequence in which the filter buttons
appear for visitors. Lower numbers first.
:::

## Bulk import / export

Categories can also be maintained via file:

- **Export:** downloads all categories as an Excel file (slug, names, icon,
  order).
- **Import:** via the import dialog, upload a CSV/Excel file to create or update
  categories.

File format details: [Import & Export](/en/admin/import-export).

## Delete a category

Via the row action with confirmation. Tents that were only assigned to this
category lose that assignment.

## Next steps

- [Assign tents to categories](/en/admin/tents)
- [Import & Export](/en/admin/import-export)
