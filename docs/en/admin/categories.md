# Managing categories

**Categories** group the tents (e.g. *Art*, *Food*, *Music*). Visitors filter the
map by them, and a tent's first category determines its **marker color**.
Categories belong to a single event.

> **Role:** **Editor** and above can edit categories.

## Category overview

Under **Categories** (`/admin/events/:slug/categories`) all categories appear
with slug, names (DE/EN), icon, color and order.

![Category management](/assets/screenshots/admin/category-list.png)

## Create or edit a category

Via the inline form:

| Field | Description |
|---|---|
| **Slug** *(required)* | Unique lowercase identifier (e.g. `food`) |
| **Name (DE)** *(required)* | German display name |
| **Name (EN)** | English display name |
| **Icon** | Emoji icon for the filter button (e.g. `🍕`, `🍺`, `🅿️`) |
| **Color** | Marker color on the map. Pick any color with the color picker, or click one of the preset swatches. Leave it empty (the **Auto** button) to derive the color automatically from the slug |
| **Order** | Number – controls the sort order of the filter buttons |

::: tip
**Order** (display_order) determines the sequence in which the filter buttons
appear for visitors. Lower numbers first.
:::

![Category form with color picker](/assets/screenshots/admin/category-color-form.png)

::: tip Marker colors
A category's **color** sets the color its tents appear in as markers on the map,
so you can establish a deliberate, consistent color scheme. When no color is
set, a color is derived automatically from the slug (the previous behavior). If a
tent has several categories, the first one wins.
:::

## Bulk import / export

Categories can also be maintained via file:

- **Export:** downloads all categories as an Excel file (slug, names, icon,
  color, order).
- **Import:** via the import dialog, upload a CSV/Excel file to create or update
  categories.

File format details: [Import & Export](/en/admin/import-export).

## Delete a category

Via the row action with confirmation. Tents that were only assigned to this
category lose that assignment.

## Next steps

- [Assign tents to categories](/en/admin/tents)
- [Import & Export](/en/admin/import-export)
