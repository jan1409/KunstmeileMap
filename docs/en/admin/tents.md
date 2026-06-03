# Managing tents

A **tent** is an exhibition or sales point on the map – with a name, description,
contact, categories, photos and a position.

> **Role:** **Contributor** and above can view/edit tents; **Editor** and above
> can create new tents.

## Tent list

Under **Tents** (`/admin/events/:slug/tents`) all tents of the event appear with
name, tent number and timestamps.

![Tent list](/assets/screenshots/admin/tent-list.png)

From here: create a new tent, edit, delete, and
[import/export](/en/admin/import-export).

## Create a new tent

**New tent** opens the form (`/admin/events/:slug/tents/new`):

![Edit tent – form](/assets/screenshots/admin/tent-edit.png)

### Fields

| Field | Description |
|---|---|
| **Name** *(required)* | Display name of the tent |
| **Slug** *(required)* | URL identifier (lowercase/digits), suggested from the name |
| **Tent number** | Shown on the map marker; auto-assigned or manual |
| **Contact person** | Name of the contact (also searchable) |
| **Description (DE/EN)** | Bilingual description text |
| **Address** | Tent address |
| **Website / Instagram / Facebook / Email** | Links (validated) |
| **Marker icon** | Optional icon (food/drink/parking) instead of the number |
| **Categories** | Multi-select; the first category determines the marker color |

::: tip Marker icons
For food/drink/service tents you can pick an icon (e.g. 🍔 burger, 🍺 beer,
☕ coffee, 🅿️ parking). It replaces the number on the map and helps visitors
orient themselves.
:::

## Set the position on the map

The tent form embeds an interactive map editor:

![Set tent position on the map](/assets/screenshots/admin/tent-map-editor.png)

1. Click the map to place the marker (or drag the marker).
2. Already-placed tents appear as **green** context markers – so you can avoid
   overlaps.
3. Toggle between **street map (OSM)** and **satellite**.
4. The current coordinates are shown and saved with the tent.

::: info Tents without a position
A tent can also be saved without coordinates – it then doesn't appear on the
map. Visitors are notified via a banner. Many tents can be placed efficiently in
the [positions editor](#set-positions-in-bulk).
:::

## Set positions in bulk

To place many tents one after another, the **positions editor**
(`/admin/events/:slug/positions`) is more efficient than the single form:

![Positions editor](/assets/screenshots/admin/positions-editor.png)

1. On the left, the list of not-yet-placed tents – select one.
2. Place the point on the map or move existing markers.
3. All changes are collected and applied at once with **Save**. Unsaved changes
   are flagged before you leave.

## Delete a tent

Delete via the row action in the tent list (with confirmation). To clear an
entire event there is also a **bulk delete** that, as a safeguard, requires
typing the event slug.

## Next steps

- [Add photos to tents](/en/admin/photos)
- [Manage categories](/en/admin/categories)
- [Import tents via CSV/Excel](/en/admin/import-export)
