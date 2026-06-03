# Managing events

An **event** is the top-level unit: each Kunstmeile edition is its own event with
its own tents, categories and photos. This page covers creating, duplicating and
configuring events.

> **Role:** Global admins can create events; the event **Owner** can change
> settings. See [Users & Roles](/en/admin/users-roles).

## Event overview

Under **Admin → Events** (`/admin/events`) all events appear with slug, title,
year, status and featured flag.

![List of events](/assets/screenshots/admin/event-list.png)

Each row links directly to tents, positions, categories, settings and users.

## Create a new event

1. In the overview, click **New event**.
2. Fill in the required fields:
   - **Slug** – unique URL identifier (lowercase, e.g. `kunstmeile-2026`)
   - **Title (DE)** and optionally **Title (EN)**
   - **Year**
3. Save. The event starts in **draft** status.

## Status & visibility

| Status | Meaning |
|---|---|
| **draft** | Visible only to signed-in editors |
| **published** | Publicly visible on the map |
| **archived** | No longer public, but preserved |

For an event to appear on the public home page (`/`), it must be **published**
and its slug set as `VITE_DEFAULT_EVENT_SLUG` (see
[Environment Variables](/en/reference/env-vars)). **Featured** marks the
highlighted default event.

## Settings

Under **Settings** (`/admin/events/:slug/settings`, Owner only) you can
configure:

![Event settings](/assets/screenshots/admin/event-settings.png)

- **Basics:** title (DE/EN), year, status, featured, start/end date
- **Default map view:** `default_lat`, `default_lng`, `default_zoom` – determines
  the viewport when the map opens
- **Photo lightbox:** `lightbox_full_size` – full resolution in the viewer or
  compressed preview only (see [Photos](/en/admin/photos))
- **Venue:** `venue_name`, `venue_address` (internal reference)
- **Export functions** (see [Import & Export](/en/admin/import-export))

::: tip Quickly determine the default map view
Set the desired viewport on the public map, read off the latitude/longitude and
zoom, and enter them here.
:::

## Duplicate an event

For a new edition you don't have to recreate anything by hand – clone an existing
event:

![Duplicate an event](/assets/screenshots/admin/event-duplicate.png)

1. In the overview, click **Duplicate**.
2. Enter a new **title**, **slug** and **year**.
3. Choose what to carry over: **tents**, **positions**, **categories**.
4. Confirm – the new event is created as a draft.

## Next steps

- [Create categories](/en/admin/categories)
- [Create tents](/en/admin/tents)
- [Import/export data](/en/admin/import-export)
