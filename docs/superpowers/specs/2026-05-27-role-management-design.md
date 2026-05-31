# Role Management — Design Spec

**Date:** 2026-05-27
**Status:** Approved, ready for implementation plan
**Author:** Brainstorm session with Jan
**Target branch:** `feat/role-management` (created from `main` at `16dca51`; parallel to `feat/excel-export` PR #29 which is still open)
**Related:** [2026-05-27-excel-export-design.md](2026-05-27-excel-export-design.md) — the other Phase-1-post-launch follow-up, designed in the same brainstorm but implemented separately.

## Context and rationale

The admin CMS currently has two roles: global `admin` and per-event `editor` / `owner`. Both per-event roles can do everything (create / edit / delete stands, categories, photos). The user wants a third, narrower role for helpers who should be able to **upload photos and correct stand information**, but not **create new stands, create events, or change structural settings**. This unlocks delegating data-entry work to the Kunstmeile organizing team without giving them owner-level keys.

Existing infrastructure already supports the concept of per-event roles via the `event_admins` join table with `role_in_event: event_role` (currently `'owner' | 'editor'`). The work here extends that enum with a third member, refines RLS policies to gate by minimum-role per action, adds a Supabase Edge Function for magic-link email invitations, and builds a per-event user-management page so owners can invite/edit/remove their team in the app.

## Out of scope

- **Audit log** of who invited whom / changed which role when. A separate `audit_log` table for a future polish pass.
- **Bulk-invite** (CSV with many emails at once). Low Phase-1 volume — manual per-email entry is fine.
- **Custom-branded email template.** Supabase default template is acceptable for launch; can be customized later in the Supabase Dashboard.
- **Self-service signup** for non-invited users. Open signup stays OFF; all access is invite-only.
- **Two-factor auth / WebAuthn** for owners. Phase 1 stays at email + password.
- **Per-action permission overrides** (e.g., "this one contributor may also edit categories"). The three-tier role system is enough granularity.
- **Owner-attached private notes** about helpers (e.g., "Helga handles Tent #42 photos"). Out of scope.
- **Cross-event role copy** (e.g., "make this user contributor in all my events"). Owner adds users per-event manually.

## Locked decisions (from brainstorming)

| # | Decision |
|---|----------|
| RM-001 | **Third role tier:** add `'contributor'` to the existing `event_role` enum. Ordering: `contributor < editor < owner`. |
| RM-002 | **Contributor permissions — CAN:** read all stands in event, upload photos, delete/reorder existing photos, edit stand text fields (name, description, address, social links, email), edit stand coordinates (lat/lng), assign categories to stands. |
| RM-003 | **Contributor permissions — CANNOT:** create new stands, delete stands, create/edit/delete events, change event settings (`default_lat/lng/zoom`, title, status), create/edit/delete categories, invite users, manage roles. |
| RM-004 | **Invitation flow:** magic-link via email through a new Supabase Edge Function (`invite-user`). Caller authenticates with their JWT; function uses service-role key to call `auth.admin.inviteUserByEmail` with `{ event_id, role_in_event }` in user metadata. |
| RM-005 | **User-management UI:** per-event, at `/admin/events/<slug>/users`. Sichtbar nur für Event-Owner + globale Admins. |
| RM-006 | **Email service:** Supabase default email service. Free-tier rate limit (~3-4 mails/hour) is sufficient for Phase 1 (a handful of invitations total). |
| RM-007 | **Photo deletion semantics:** anyone with `canContribute` rights can delete any photo on any tent in the event. No per-photo uploader-tracking. Simpler. |
| RM-008 | **Self-protection in UI:** Event-Owner cannot demote or remove themselves via the in-app UI (would lock themselves out). Global admin has no such constraint (they can always re-elevate via Supabase Dashboard or another admin). |
| RM-009 | **Pending state visibility:** Invited users who haven't yet confirmed their email show up in the user list as "(Pending)" — visible to the inviting owner so they can re-send if needed. |
| RM-010 | **EventListPage filtering:** non-global users see only the events they're a member of. Achieved via existing RLS on `events` — no Frontend change needed beyond verification. |
| RM-011 | **RLS = security boundary, UI gates = UX only:** even if a contributor manually navigates to `/admin/events/.../settings`, the underlying `UPDATE events` is rejected by RLS. The UI gates exist for guidance, not enforcement. |
| RM-012 | **Migration split:** two separate SQL migrations (Postgres won't let a single transaction both `ALTER TYPE … ADD VALUE` and use the new value). Migration A adds the enum value; Migration B (timestamp +1 second) extends helper functions, RLS policies, and the `handle_new_user` trigger. |

## Data model changes

### Migration A — `<UTC-ts>_add_contributor_role.sql`

```sql
alter type event_role add value 'contributor' before 'editor';
```

Single-statement migration. After this commit, `event_role` has three members in this order: `contributor`, `editor`, `owner`.

### Migration B — `<UTC-ts+1s>_role_management_policies.sql`

Contains the rest of the role-management schema work:

1. **`has_event_role(eid uuid, min_role event_role)` rewrite:**

```sql
create or replace function public.has_event_role(eid uuid, min_role event_role default 'editor')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_admins
    where event_id = eid
      and profile_id = auth.uid()
      and case min_role
        when 'contributor' then role_in_event in ('contributor', 'editor', 'owner')
        when 'editor'      then role_in_event in ('editor', 'owner')
        when 'owner'       then role_in_event = 'owner'
      end
  );
$$;
```

2. **RLS policy audit + updates.** For each affected table, drop existing policies and recreate with the new minimum-role semantics:

| Table / Action | Current min_role | New min_role |
|---|---|---|
| `tents` INSERT | editor | **editor** (unchanged) |
| `tents` UPDATE | editor | **contributor** (new — contributor may edit) |
| `tents` DELETE | editor | **editor** (unchanged) |
| `tent_photos` INSERT | editor | **contributor** (new) |
| `tent_photos` UPDATE | editor | **contributor** (new) |
| `tent_photos` DELETE | editor | **contributor** (new) |
| `tent_categories` INSERT/DELETE | editor | **contributor** (new — contributor may assign categories) |
| `categories` ALL | editor | **editor** (unchanged) |
| `events` UPDATE | owner | **owner** (unchanged) |
| `events` DELETE | owner | **owner** (unchanged) |
| `event_admins` SELECT | editor | **editor** (unchanged — contributor doesn't see user list) |
| `event_admins` INSERT/UPDATE/DELETE | owner | **owner** (unchanged) |
| Storage bucket `tent-photos` | editor | **contributor** (new — must mirror tent_photos table policy) |

3. **`handle_new_user` trigger extension** — read `invited_event_id` + `invited_role` from `auth.users.raw_user_meta_data` and create `event_admins` row if present:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  invited_event uuid;
  invited_role event_role;
begin
  -- Existing behavior: create profile row with default 'editor' global role.
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'editor');

  -- New: if metadata carries invite context, materialize the event membership.
  invited_event := nullif(new.raw_user_meta_data->>'invited_event_id', '')::uuid;
  invited_role  := nullif(new.raw_user_meta_data->>'invited_role', '')::event_role;
  if invited_event is not null and invited_role is not null then
    insert into public.event_admins (event_id, profile_id, role_in_event)
    values (invited_event, new.id, invited_role);
  end if;
  return new;
end $$;
```

4. **New RPC `get_event_permissions(eid uuid)`** — returns the four booleans the frontend needs in one query:

```sql
create or replace function public.get_event_permissions(eid uuid)
returns table (
  can_access boolean,
  can_contribute boolean,
  can_edit boolean,
  can_own boolean
) language sql stable security definer set search_path = public as $$
  select
    is_admin() or has_event_role(eid, 'contributor') as can_access,
    is_admin() or has_event_role(eid, 'contributor') as can_contribute,
    is_admin() or has_event_role(eid, 'editor')       as can_edit,
    is_admin() or has_event_role(eid, 'owner')        as can_own;
$$;
```

5. **New RPC `get_event_users(eid uuid)`** — returns the user list joined with auth metadata, gated by Owner+ access:

```sql
create or replace function public.get_event_users(eid uuid)
returns table (
  profile_id uuid,
  email text,
  full_name text,
  role_in_event event_role,
  email_confirmed_at timestamptz,
  invited_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    ea.profile_id,
    au.email::text,
    p.full_name,
    ea.role_in_event,
    au.email_confirmed_at,
    au.created_at
  from event_admins ea
    join profiles p on p.id = ea.profile_id
    join auth.users au on au.id = ea.profile_id
  where ea.event_id = eid
    and (is_admin() or has_event_role(eid, 'owner'));
$$;
```

6. **Type regeneration:** `pnpm types:gen` after both migrations apply. The regenerated `src/types/supabase.ts` will include the new enum member + RPC signatures.

## Code architecture changes

### New files

| Path | Responsibility |
|---|---|
| `supabase/functions/invite-user/index.ts` | Deno Edge Function. Verifies caller JWT, checks Owner-or-admin permission via SQL call, calls `auth.admin.inviteUserByEmail(email, { data: { invited_event_id, invited_role } })`. Returns `{ ok, user_id }` or `{ error, code }`. |
| `supabase/functions/invite-user/README.md` | Step-by-step deploy instructions: `supabase functions deploy invite-user`, env-var setup (service role key — provided automatically by Supabase runtime), local test via `supabase functions serve`. |
| `src/hooks/useEventPermissions.ts` | React hook calling `rpc('get_event_permissions', { eid })`. Returns `{ loading, canAccess, canContribute, canEdit, canOwn }`. |
| `src/hooks/useEventPermissions.test.ts` | Unit tests for all role combinations (global admin, owner, editor, contributor, non-member). |
| `src/hooks/useEventUsers.ts` | React hook calling `rpc('get_event_users', { eid })`. Returns `{ users, loading, error, refetch }`. |
| `src/components/RequireEventRole.tsx` | Route-guard wrapper component. Props: `eventSlug` (derived from `useParams` if omitted), `minRole: 'contributor' \| 'editor' \| 'owner'`. Shows loading spinner while `useEventPermissions` resolves, redirects with `<Navigate>` if permission denied, otherwise renders children. |
| `tests/unit/components/RequireEventRole.test.tsx` | Tests for the route guard. |
| `src/pages/admin/UsersPage.tsx` | The user-management page. Renders InviteUserForm + UsersList (composed of UserRow). Uses `useEventUsers` + `useEventPermissions`. |
| `tests/unit/pages/admin/UsersPage.test.tsx` | Page-level tests. |
| `src/components/InviteUserForm.tsx` | Email input + role radio buttons + submit. Calls the Edge Function. Shows success/error toast. |
| `tests/unit/components/InviteUserForm.test.tsx` | Form tests. |
| `src/components/UserRow.tsx` | One row in the user list: email, current role dropdown, remove button. Handles the self-protection in RM-008. |
| `tests/unit/components/UserRow.test.tsx` | Row tests. |
| `tests/manual/role-management-smoke.md` | Manual smoke checklist. |

### Modified files

| Path | Change |
|---|---|
| `src/types/supabase.ts` | Regenerated. Adds the enum member + two new RPC signatures. |
| `src/hooks/useCanEditEvent.ts` | Replaced by `useEventPermissions`. The 2-3 existing call sites switch to the new hook's `canContribute` boolean. |
| `src/routes.tsx` | New route `/admin/events/:eventSlug/users` → `<RequireEventRole minRole="owner"><UsersPage /></RequireEventRole>`. Existing routes wrapped with appropriate `<RequireEventRole>`: TentImportPage and TentEditPage create-mode → `minRole="editor"`. CategoryListPage → `minRole="editor"`. EventSettingsPage → `minRole="owner"`. TentEditPage edit-mode → `minRole="contributor"`. TentListPage → `minRole="contributor"`. |
| `src/components/SidePanel.tsx` | `AddPhotosControl` + manage-photos link gated on `canContribute` (from useEventPermissions) instead of the existing `canEdit` (from useCanEditEvent). |
| `src/pages/admin/AdminLayout.tsx` | Conditional "Users" nav-link (visible only if any event in the user's portfolio has `canOwn=true` for them, or `is_admin()`). Simple version: always-visible for global admins, conditionally-visible from the per-event TentListPage (where the slug is known). |
| `src/pages/admin/TentListPage.tsx` | "+ Neuer Stand" and "CSV-Import" Buttons gated on `canEdit`. "↓ Excel-Export" (from PR #29 when merged) stays available for `canAccess`. |
| `src/pages/admin/CategoryListPage.tsx` | Route already gated via `RequireEventRole`; no internal changes needed unless the page renders create/delete buttons that need additional inline gates (they don't — the whole page is editor-only). |
| `src/pages/admin/EventListPage.tsx` | No frontend change required (RLS already filters to events the user is a member of). Add a verification test. |
| `src/locales/de/common.json` + `en/common.json` | ~15 new keys under `admin.users.*` and `admin.nav.users`. |
| `package.json` | Optional: add `supabase:functions:deploy` script wrapping `supabase functions deploy invite-user`. |

### Files NOT modified

- `src/lib/excel.ts`, `src/components/MapView.tsx`, `src/components/TentMapEditor.tsx`, `src/components/TentMarker.tsx`, `src/lib/map.ts` — feature is orthogonal to the map work.
- Database tables themselves (no new columns added).
- Tent / category data model.
- Public viewer behavior (other than the SidePanel gate semantics).

## Edge Function `invite-user`

### Endpoint

`POST /functions/v1/invite-user`

### Headers

```
Authorization: Bearer <user-jwt>
Content-Type: application/json
```

### Request body

```ts
{
  email: string;
  event_id: string;
  role_in_event: 'owner' | 'editor' | 'contributor';
}
```

### Behavior

1. **Authenticate caller.** Extract JWT from Authorization header. Use `supabase.auth.getUser(jwt)` to resolve the user's id. If anonymous → 401.
2. **Authorize caller.** Call `supabase.rpc('get_event_permissions', { eid: event_id })` using the caller's JWT. If `can_own !== true` → 403.
3. **Check existing user.** Use service-role client to `supabase.auth.admin.listUsers({ filter: \`email.eq.${email}\` })`. If a user with this email already exists:
   - Check if they already have `event_admins` row for this event. If yes → return `{ error: 'already_member', existing_role: '...' }`.
   - If no → insert `event_admins` row directly (no new auth invite, no email). Return `{ ok: true, user_id, status: 'added_to_existing_user' }`.
4. **Invite new user.** Call `supabase.auth.admin.inviteUserByEmail(email, { data: { invited_event_id: event_id, invited_role: role_in_event } })`. The `handle_new_user` trigger will create both `profiles` and `event_admins` rows when the invitee confirms.
5. **Response shapes:**
   - `200 { ok: true, user_id, status: 'invited' }` — new invitation sent.
   - `200 { ok: true, user_id, status: 'added_to_existing_user' }` — existing user added to this event.
   - `400 { error: 'already_member', existing_role }` — same email already has a role in this event.
   - `401 { error: 'unauthenticated' }`.
   - `403 { error: 'not_event_owner' }`.
   - `500 { error: 'internal', message }` — bubble Supabase API errors.

### Re-invite flow (RM-009)

If a previously-invited user hasn't confirmed (`email_confirmed_at IS NULL` in `auth.users`), the UsersPage shows a "Einladung erneut senden" button. That button calls a different action — `supabase.auth.admin.generateLink({ type: 'invite', email })` via a second Edge-Function endpoint OR a new param `{ resend: true }` to the existing endpoint. Plan-level decision: add a `resend` param to `invite-user` and let it call `generateLink` instead of `inviteUserByEmail`.

### Local development

```bash
supabase functions serve invite-user --env-file ./supabase/.env.local
```

The Supabase CLI proxies the function to `http://localhost:54321/functions/v1/invite-user`. Service-role key is auto-injected from the local Supabase environment.

### Deploy

```bash
supabase functions deploy invite-user
```

Single command. The function picks up the production project's service-role key from Supabase's secret store automatically — no manual env-var management.

## User-management UI

### Page structure

```
┌────────────────────────────────────────────────────────────┐
│ Users — Kunstmeile 2026                                     │
│                                                             │
│ ┌─ Neuen User einladen ──────────────────────────────────┐ │
│ │ Email: [contributor@example.com         ]               │ │
│ │ Rolle: ◯ Contributor  ◯ Editor  ◯ Owner                 │ │
│ │ [Einladung senden]                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Aktuelle User                                               │
│ ┌─────────────────────┬─────────────┬────────────────────┐ │
│ │ Email               │ Rolle       │ Aktionen           │ │
│ ├─────────────────────┼─────────────┼────────────────────┤ │
│ │ jan@example.com     │ Owner ▾     │ Du selbst          │ │
│ │ helga@example.com   │ Editor ▾    │ [Entfernen]        │ │
│ │ neuer@example.com   │ Contributor▾│ [Entfernen]        │ │
│ │ pending@example.com │ Editor ▾    │ [Erneut senden]    │ │
│ └─────────────────────┴─────────────┴────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Behavior details

- **Role dropdown:** inline-edit. Click "Editor ▾" → small dropdown with the three roles → on select, calls `supabase.from('event_admins').update({ role_in_event }).eq('event_id', eid).eq('profile_id', pid)`. RLS policy (Owner-only) gates server-side. Optimistic UI update with rollback on error.
- **Remove button:** confirmation step (two-click "Klick zum Bestätigen") before `supabase.from('event_admins').delete()`. Same RLS gate.
- **Pending state:** if `email_confirmed_at IS NULL` for the user, the actions column shows "Pending" + "Erneut senden"-Button. Email shows "(Pending)" prefix.
- **Self-protection:** the eingeloggte Owner sees their own row with role dropdown disabled and "Du selbst" label instead of remove button. Global admins (`is_admin()`) see no such restriction even on their own row (they can always re-elevate via Supabase Dashboard).
- **Empty state:** if only the eingeloggte Owner is in the event, the table shows a hint "Lade Mitstreiter ein …".

### Component split

- **UsersPage** owns: data fetching via `useEventUsers`, permission check via `useEventPermissions` (renders 403 / redirect if not Owner+), composition of InviteUserForm + UsersList table.
- **InviteUserForm** owns: email input (zod validation), role radio, submit handler that calls the Edge Function, success/error toasts via `useToast`.
- **UserRow** owns: rendering one row, role-dropdown state, remove-confirm state, calling supabase mutations, optimistic update + rollback.

## i18n keys

New keys (DE + EN) under `admin.nav.users` and `admin.users.*`:

- `admin.nav.users` — "Users" / "Benutzer"
- `admin.users.heading` — "Benutzer — {{title}}" / "Users — {{title}}"
- `admin.users.invite_heading` — "Neuen User einladen" / "Invite new user"
- `admin.users.invite_email_label` — "Email"
- `admin.users.invite_role_label` — "Rolle" / "Role"
- `admin.users.role_owner` — "Owner" (same in both)
- `admin.users.role_editor` — "Editor" (same)
- `admin.users.role_contributor` — "Contributor" (same)
- `admin.users.invite_submit` — "Einladung senden" / "Send invitation"
- `admin.users.invite_sending` — "Senden …" / "Sending…"
- `admin.users.invite_success` — "Einladung an {{email}} versandt." / "Invitation sent to {{email}}."
- `admin.users.invite_already_member` — "Benutzer {{email}} ist bereits Mitglied dieses Events." / "User {{email}} is already a member of this event."
- `admin.users.invite_error` — "Einladung fehlgeschlagen: {{message}}" / "Invitation failed: {{message}}"
- `admin.users.list_heading` — "Aktuelle Benutzer" / "Current users"
- `admin.users.col_email` — "Email"
- `admin.users.col_role` — "Rolle" / "Role"
- `admin.users.col_actions` — "Aktionen" / "Actions"
- `admin.users.action_remove` — "Entfernen" / "Remove"
- `admin.users.action_confirm_remove` — "Klick zum Bestätigen" / "Click to confirm"
- `admin.users.action_resend_invite` — "Erneut senden" / "Resend"
- `admin.users.you_label` — "Du selbst" / "You"
- `admin.users.pending_prefix` — "(Pending)"
- `admin.users.empty` — "Lade Mitstreiter ein, indem du oben eine Email einträgst." / "Invite collaborators by entering an email above."

## Test strategy

### Unit tests

- `useEventPermissions` — 5 cases (global admin / owner / editor / contributor / non-member).
- `RequireEventRole` — 3 cases (loading, denied → redirect, granted → render).
- `InviteUserForm` — 3 cases (validates email, calls function on submit, shows error toast on failure).
- `UserRow` — 4 cases (role-dropdown change, remove flow, self-row disabled, pending-row resend).
- `UsersPage` — 2 cases (owner sees full UI, editor is redirected).

### Existing test updates

- `TentListPage.test.tsx` — extend with: contributor sees no "+ Neuer Stand" / "CSV-Import"; editor sees both.
- `CategoryListPage.test.tsx` — extend: contributor is redirected.
- `EventSettingsPage.test.tsx` — extend: contributor + editor redirected; owner sees the page.
- `SidePanel.test.tsx` — extend: contributor sees AddPhotosControl button.

### Edge Function test

Not in Vitest (Deno runtime). Manually smoke via:

```bash
curl -X POST 'http://localhost:54321/functions/v1/invite-user' \
  -H "Authorization: Bearer $USER_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","event_id":"<uuid>","role_in_event":"contributor"}'
```

Document this in `supabase/functions/invite-user/README.md`.

### Manual smoke

See `tests/manual/role-management-smoke.md` (created in T7 of the implementation plan).

## Effort estimate

| Chunk | Engineering time |
|---|---|
| Migration A + B + RPC functions | ~3-4h |
| Edge Function + Deploy setup + README | ~3-4h |
| `useEventPermissions` + `RequireEventRole` | ~2h |
| UsersPage + InviteUserForm + UserRow + useEventUsers | ~4-5h |
| UI gates across ~10 existing files | ~2-3h |
| i18n keys (DE + EN) | ~1h |
| Tests (unit + manual smoke) | ~3-4h |
| **Total** | **~18-23h (3 Arbeitstage)** |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Edge Function deploy is new infra for this project — may consume time on first setup | Step-by-step README in `supabase/functions/invite-user/README.md`. Local-test via `supabase functions serve` before remote deploy. |
| Default email service rate-limited (3-4/h on free tier) | Acceptable for Phase 1 invitation volume (~5-10 users total). Document the limit; bigger volumes need custom SMTP later. |
| ENUM extension cannot be used in the same transaction → migrations must split | Two migration files, 1-second timestamp gap. Standard Postgres pattern. |
| `handle_new_user` trigger extension could break existing signup flow | Trigger is extended additively, not replaced. Existing path (no `invited_event_id` in metadata) behaves identically. Test both paths. |
| Storage bucket policy must mirror table policy or photo uploads fail | Migration B includes both `tent_photos` table policies AND the Supabase Storage bucket policy update. Smoke step verifies a contributor's photo upload succeeds end-to-end. |
| Re-invitation of existing user (already has account, also already in event) | Edge Function returns `400 { error: 'already_member' }` with the existing role. UI shows clear message. |
| Owner accidentally locks themselves out via role change | UI self-protection in `UserRow` (RM-008). Globaler Admin keeps emergency access via Supabase Dashboard regardless. |
| Stale browser session: user's role was just demoted but they're still logged in with old client state | useEventPermissions refetches on route changes (effect deps on eventSlug). For longer-lived sessions, the RLS-level enforcement still blocks any write attempts even if the UI hasn't caught up. |
| `useCanEditEvent` is referenced from multiple places — refactoring may surface unexpected callers | Implementation grep verifies all callers. Replace systematically; the new `useEventPermissions.canContribute` is semantically equivalent. |

## Acceptance criteria

Feature ships when:

1. `pnpm test:run`, `pnpm type-check`, `pnpm lint`, `pnpm build` all clean.
2. The new unit tests for `useEventPermissions`, `RequireEventRole`, `UsersPage`, `InviteUserForm`, `UserRow` all pass.
3. The manual smoke checklist (`tests/manual/role-management-smoke.md`) is completed against the Vercel preview with three distinct test accounts (Owner, Editor, Contributor).
4. Production Supabase project has Migration A + B applied; the Edge Function `invite-user` is deployed and reachable.
5. Default Supabase Auth email template is verified working — at least one real magic-link invitation is delivered and consumed.
6. PR squash-merges to main without conflicts.

## Open questions

None — all design decisions are locked above. Implementation can proceed via the writing-plans skill.
