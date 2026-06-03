# Users & Roles

Access to the admin area is controlled per event via **roles**. This page covers
the roles, inviting users and signing in.

## Sign in

The admin area is entered via `/admin/login` using a **magic link** (email):

![Admin sign-in (magic link)](/assets/screenshots/admin/login.png)

1. Enter your email address.
2. Click the link you receive by email.
3. You land in the admin dashboard.

![Admin dashboard](/assets/screenshots/admin/dashboard.png)

::: info No access?
Someone who is signed in but not assigned to any event as Owner/Editor/
Contributor sees a “No access” notice. An Owner or admin then has to invite them.
:::

## Role model

There are two levels: **global** roles and **per-event** roles.

### Global role

| Role | Rights |
|---|---|
| **admin** | Can create and manage events |
| **editor** | Standard user without global special rights |

### Per-event role

| Role | Rights |
|---|---|
| **Owner** | Full control incl. settings, exports and user management |
| **Editor** | Edit tents, categories and positions |
| **Contributor** | View/edit tents and positions, upload photos (categories read-only) |

## Manage users

On the users page (`/admin/events/:slug/users`, **Owner** only) all members
appear with email, name, role and invitation status:

![User and role management](/assets/screenshots/admin/users-page.png)

You can:

- **Change role** – via the selector (Contributor ↔ Editor ↔ Owner)
- **Remove user**
- **Resend invitation** – for users who haven't confirmed yet

## Invite a user

![Invite a user](/assets/screenshots/admin/invite-user.png)

1. Enter an email address and choose a **role** (Contributor / Editor / Owner).
2. Submit – the person receives an invitation with a magic link and can set a
   password on first login.

::: info Technical background
Inviting runs through the Supabase edge function `invite-user`. Only event
**Owners** (or global admins) may invite. The various response states (invited,
already a member, resent …) are documented in
`supabase/functions/invite-user/README.md`.
:::

## Next steps

- [Managing events](/en/admin/events)
- [Managing tents](/en/admin/tents)
