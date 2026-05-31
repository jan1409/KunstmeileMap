# Role Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "contributor" role (below editor) on the existing `event_admins` table, plus a magic-link email invitation flow via a new Supabase Edge Function, plus a per-event user-management page so owners can invite/edit/remove team members in the app.

**Architecture:** Schema-driven. Migration A adds the enum member; Migration B refines RLS policies, helper functions, the auto-profile trigger, and adds two new SECURITY-DEFINER RPCs. A new `invite-user` Deno Edge Function bridges the frontend to `auth.admin.inviteUserByEmail` (which requires the service-role key, never exposed to the browser). The frontend gets a new `useEventPermissions` hook (4 booleans), a `RequireEventRole` route-guard component, and a `/admin/events/<slug>/users` page. UI gates across ~10 existing files are switched from the old `useCanEditEvent` to the new permission hooks.

**Tech Stack:** Supabase PostgreSQL + Auth + Edge Functions (Deno), React 19 + TypeScript 6 + Vite 8, Vitest 4 + RTL, react-router-dom 7, i18next 26.

**Spec:** [docs/superpowers/specs/2026-05-27-role-management-design.md](../specs/2026-05-27-role-management-design.md)

**Working branch:** `feat/role-management` (already created from `main` at `16dca51`; the spec commit `dbcf631` is the only commit on the branch so far). Parallel to `feat/excel-export` PR #29 which is still open — both PRs will be merged in order, with the second one rebasing minor conflicts in `TentListPage.tsx` and locale JSONs.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260527130000_add_contributor_role.sql` | `ALTER TYPE event_role ADD VALUE 'contributor' BEFORE 'editor'`. Alone, because Postgres requires the new enum value to be committed before it can be referenced. |
| `supabase/migrations/20260527130001_role_management_policies.sql` | Rewrites `has_event_role`. Splits `tents_editor_write` policy into INSERT/UPDATE/DELETE with different min_role. Drops + recreates `tent_photos`, `tent_categories`, and storage-bucket policies with `'contributor'` min_role. Extends `handle_new_user` trigger to read invite metadata. Adds `get_event_permissions(eid)` and `get_event_users(eid)` RPCs. |
| `supabase/functions/invite-user/index.ts` | Deno Edge Function. Authenticates caller, gates on Owner, calls `auth.admin.inviteUserByEmail`. |
| `supabase/functions/invite-user/README.md` | Deploy + local-test instructions. |
| `src/hooks/useEventPermissions.ts` | Hook calling `rpc('get_event_permissions')`. Returns `{ loading, canAccess, canContribute, canEdit, canOwn }`. |
| `src/hooks/useEventUsers.ts` | Hook calling `rpc('get_event_users')`. Returns `{ users, loading, error, refetch }`. |
| `src/components/RequireEventRole.tsx` | Route-guard wrapper. Reads `eventSlug` from `useParams`, resolves the event id via `useEvent`, then calls `useEventPermissions`. Renders loading, redirect, or children. |
| `src/components/InviteUserForm.tsx` | Email + role radio + submit. Calls `supabase.functions.invoke('invite-user', { ... })`. |
| `src/components/UserRow.tsx` | One row in the user list: email, role dropdown, remove button. Handles self-protection. |
| `src/pages/admin/UsersPage.tsx` | The page. Composes InviteUserForm + UsersList (UserRow per user). Uses both hooks. |
| `tests/unit/hooks/useEventPermissions.test.ts` | Unit tests for the 4 booleans across all role permutations. |
| `tests/unit/components/RequireEventRole.test.tsx` | Tests for loading/redirect/render. |
| `tests/unit/components/InviteUserForm.test.tsx` | Form tests. |
| `tests/unit/components/UserRow.test.tsx` | Row tests. |
| `tests/unit/pages/admin/UsersPage.test.tsx` | Page-level tests. |
| `tests/manual/role-management-smoke.md` | Manual multi-account smoke checklist. |

### Modified files

| Path | Change |
|---|---|
| `src/types/supabase.ts` | Regenerated after Migration B. Adds enum value + RPC signatures. |
| `src/hooks/useCanEditEvent.ts` | Replaced with a thin wrapper over `useEventPermissions.canContribute` (or deleted entirely after callers migrate). |
| `src/routes.tsx` | New route `/admin/events/:eventSlug/users` → `<RequireEventRole minRole="owner"><UsersPage /></RequireEventRole>`. Existing routes wrapped with appropriate guards (TentImportPage editor, TentEditPage new-mode editor, TentEditPage edit-mode contributor, CategoryListPage editor, EventSettingsPage owner, TentListPage contributor). |
| `src/components/SidePanel.tsx` | Swap `useCanEditEvent` → `useEventPermissions` and use `canContribute` instead of `canEdit`. |
| `src/pages/admin/TentListPage.tsx` | Gate `+ Neuer Stand` and `CSV-Import` buttons on `canEdit`. Export button (from PR #29 when merged) stays on `canAccess`. |
| `src/pages/admin/AdminLayout.tsx` | Conditional `Users` nav-link visible only if the current page's event has `canOwn === true`. |
| `src/locales/de/common.json`, `src/locales/en/common.json` | Add `admin.nav.users` + ~15 keys under `admin.users.*`. |
| Existing tests for `TentListPage`, `CategoryListPage`, `SidePanel`, `EventSettingsPage` | Add `vi.mock` for `useEventPermissions` (mirroring the `useCanEditEvent` mock pattern). Extend with role-permission assertions. |

### Files NOT modified

- Any `src/lib/excel.ts`, map-related components, public viewer routing (other than SidePanel).
- Existing database tables (no new columns added).
- `package.json` (no new deps; SheetJS / Supabase / Deno toolchain all already in place via Supabase CLI).

---

## Task 1 — Migration A: add `'contributor'` to `event_role` enum

**Files:**
- Create: `supabase/migrations/20260527130000_add_contributor_role.sql`

- [ ] **Step 1.1: Write the migration file**

Create `supabase/migrations/20260527130000_add_contributor_role.sql` with:

```sql
-- Adds a third, narrower role to the per-event role enum.
-- Ordering: contributor < editor < owner. A separate migration is required
-- because Postgres does not allow ADD VALUE and uses of the new value in the
-- same transaction. The follow-up migration 20260527130001 references this
-- value in policies and helper functions.
alter type event_role add value 'contributor' before 'editor';
```

- [ ] **Step 1.2: Apply locally**

Run:
```bash
pnpm supabase db reset
```

Expected: all 11 migrations apply cleanly (8 from before + map-pivot's 1 + this new one). The output mentions `Applying migration ... add_contributor_role.sql`.

If the reset complains, fix the SQL and re-run.

- [ ] **Step 1.3: Verify the enum was extended**

Open the local Supabase Studio (`http://127.0.0.1:54323` per `pnpm supabase status`) → Database → Enumerated Types. Confirm `event_role` lists three values: `contributor`, `editor`, `owner`.

Alternatively via SQL:
```bash
docker exec supabase_db_KunstmeileMap psql -U postgres -d postgres -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'event_role'::regtype ORDER BY enumsortorder;"
```

Expected output:
```
 enumlabel
-----------
 contributor
 editor
 owner
(3 rows)
```

- [ ] **Step 1.4: Run tests (sanity)**

```bash
pnpm test:run
```

Expected: 187 tests still pass (no test interaction with the new enum value yet). Type-check is allowed to fail because `src/types/supabase.ts` hasn't been regenerated — that happens in T2.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/20260527130000_add_contributor_role.sql
git commit -m "$(cat <<'EOF'
feat(db): add 'contributor' event_role enum value

A separate migration is required because Postgres rejects ADD VALUE and
uses of the new value in the same transaction. T2 follows with the
policy + helper updates that actually reference 'contributor'.
EOF
)"
```

- [ ] **Step 1.6: Do NOT push to remote yet**

Remote push happens at the end (T8) after the full feature is verified. The Supabase production DB will receive both Migration A and B in one `pnpm supabase db push` invocation then.

---

## Task 2 — Migration B: RLS policies + helpers + trigger + RPCs

**Files:**
- Create: `supabase/migrations/20260527130001_role_management_policies.sql`
- Modify: `src/types/supabase.ts` (regenerated by `pnpm types:gen`)

- [ ] **Step 2.1: Write the migration file**

Create `supabase/migrations/20260527130001_role_management_policies.sql`:

```sql
-- Role management: updates RLS policies, helper functions, and the auto-profile
-- trigger to support the new 'contributor' tier (introduced in 20260527130000).
-- Adds two SECURITY DEFINER RPCs that the frontend needs.

-- ========================================================================
-- 1. has_event_role — three-tier case logic
-- ========================================================================

create or replace function public.has_event_role(eid uuid, min_role event_role default 'editor')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

comment on function has_event_role(uuid, event_role) is
  'True when the caller has at least the given role on the given event. Three-tier: contributor < editor < owner.';

-- ========================================================================
-- 2. tents — split FOR ALL into INSERT/UPDATE/DELETE with different gates
-- ========================================================================

drop policy if exists tents_editor_write on tents;

-- INSERT/DELETE: editor or owner (contributor cannot create/delete).
create policy tents_editor_insert on tents for insert
  with check (has_event_role(event_id, 'editor') or is_admin());

create policy tents_editor_delete on tents for delete
  using (has_event_role(event_id, 'editor') or is_admin());

-- UPDATE: contributor or above (contributor can edit existing stands).
create policy tents_contributor_update on tents for update
  using (has_event_role(event_id, 'contributor') or is_admin())
  with check (has_event_role(event_id, 'contributor') or is_admin());

-- ========================================================================
-- 3. tent_photos — lower the bar to 'contributor' for all writes
-- ========================================================================

drop policy if exists tent_photos_editor_write on tent_photos;

create policy tent_photos_contributor_write on tent_photos for all
  using (
    exists (
      select 1 from tents t
      where t.id = tent_photos.tent_id
        and (has_event_role(t.event_id, 'contributor') or is_admin())
    )
  )
  with check (
    exists (
      select 1 from tents t
      where t.id = tent_photos.tent_id
        and (has_event_role(t.event_id, 'contributor') or is_admin())
    )
  );

-- ========================================================================
-- 4. tent_categories — lower the bar to 'contributor' (contributors assign
--    categories to existing stands as part of editing)
-- ========================================================================

drop policy if exists tent_categories_admin_write on tent_categories;

create policy tent_categories_contributor_write on tent_categories for all
  using (
    is_admin()
    or exists (
      select 1 from tents t
      where t.id = tent_categories.tent_id
        and has_event_role(t.event_id, 'contributor')
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from tents t
      where t.id = tent_categories.tent_id
        and has_event_role(t.event_id, 'contributor')
    )
  );

-- ========================================================================
-- 5. Storage bucket 'tent-photos' — mirror the table-level lower bar
-- ========================================================================

drop policy if exists "tent_photos_editor_insert" on storage.objects;
drop policy if exists "tent_photos_editor_update" on storage.objects;
drop policy if exists "tent_photos_editor_delete" on storage.objects;

create policy "tent_photos_contributor_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid, 'contributor')
      or is_admin()
    )
  );

create policy "tent_photos_contributor_update"
  on storage.objects for update
  using (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid, 'contributor')
      or is_admin()
    )
  );

create policy "tent_photos_contributor_delete"
  on storage.objects for delete
  using (
    bucket_id = 'tent-photos'
    and (
      has_event_role((storage.foldername(name))[1]::uuid, 'contributor')
      or is_admin()
    )
  );

-- ========================================================================
-- 6. handle_new_user — read invitation metadata, materialize event_admins row
-- ========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_event uuid;
  invited_role event_role;
begin
  -- Existing behavior: create profile row with default global role 'editor'.
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'editor'
  );

  -- New: if the invite metadata is present (set by the invite-user Edge
  -- Function via inviteUserByEmail's `data` param), materialize the
  -- event_admins membership. Both fields must be present and parseable.
  invited_event := nullif(new.raw_user_meta_data ->> 'invited_event_id', '')::uuid;
  invited_role  := nullif(new.raw_user_meta_data ->> 'invited_role', '')::event_role;
  if invited_event is not null and invited_role is not null then
    insert into public.event_admins (event_id, profile_id, role_in_event)
    values (invited_event, new.id, invited_role)
    on conflict (event_id, profile_id) do update set role_in_event = excluded.role_in_event;
  end if;
  return new;
end;
$$;

comment on function handle_new_user() is
  'Trigger: mirror auth.users inserts into public.profiles. If invite metadata is present (invited_event_id + invited_role), also create the event_admins row.';

-- ========================================================================
-- 7. get_event_permissions(eid) — the 4-boolean RPC the frontend needs
-- ========================================================================

create or replace function public.get_event_permissions(eid uuid)
returns table (
  can_access boolean,
  can_contribute boolean,
  can_edit boolean,
  can_own boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin() or has_event_role(eid, 'contributor') as can_access,
    is_admin() or has_event_role(eid, 'contributor') as can_contribute,
    is_admin() or has_event_role(eid, 'editor')      as can_edit,
    is_admin() or has_event_role(eid, 'owner')       as can_own;
$$;

comment on function get_event_permissions(uuid) is
  'Returns the four event-scoped permission booleans for the caller. UI uses this to gate buttons + routes.';

grant execute on function public.get_event_permissions(uuid) to authenticated;

-- ========================================================================
-- 8. get_event_users(eid) — owner-only user list with auth metadata
-- ========================================================================

create or replace function public.get_event_users(eid uuid)
returns table (
  profile_id uuid,
  email text,
  full_name text,
  role_in_event event_role,
  email_confirmed_at timestamptz,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ea.profile_id,
    au.email::text,
    p.full_name,
    ea.role_in_event,
    au.email_confirmed_at,
    au.created_at as invited_at
  from event_admins ea
    join profiles p on p.id = ea.profile_id
    join auth.users au on au.id = ea.profile_id
  where ea.event_id = eid
    and (is_admin() or has_event_role(eid, 'owner'));
$$;

comment on function get_event_users(uuid) is
  'Returns the user list for an event, joined with auth.users for email/email_confirmed_at. Owner+admin only.';

grant execute on function public.get_event_users(uuid) to authenticated;
```

- [ ] **Step 2.2: Apply locally**

```bash
pnpm supabase db reset
```

Expected: all 12 migrations apply cleanly. Output mentions both `add_contributor_role.sql` and `role_management_policies.sql`.

- [ ] **Step 2.3: Verify behavior via SQL**

```bash
docker exec supabase_db_KunstmeileMap psql -U postgres -d postgres -c "SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('has_event_role', 'get_event_permissions', 'get_event_users', 'handle_new_user') ORDER BY proname;"
```

Expected:
```
       proname
----------------------
 get_event_permissions
 get_event_users
 handle_new_user
 has_event_role
(4 rows)
```

- [ ] **Step 2.4: Regenerate TypeScript types**

```bash
pnpm types:gen
```

> **Note for the engineer:** the project's `types:gen` script uses `--linked` which targets the REMOTE supabase project. Since the remote DB doesn't yet have these migrations applied, `--linked` would return the OLD schema. Override for local generation: temporarily edit `package.json`'s `types:gen` to `supabase gen types typescript --local > src/types/supabase.ts` for this one regen, OR run directly:
> ```bash
> npx supabase gen types typescript --local > src/types/supabase.ts
> ```
> Either way, the regenerated file should include the new RPC signatures and the extended `event_role` enum. The user will run the standard `--linked` version after the production push completes.

Verify the regenerated file with a quick grep:
```bash
grep -E "contributor|get_event_permissions|get_event_users" src/types/supabase.ts | head -20
```

Expected: hits showing the enum member is `"contributor" | "editor" | "owner"` and both RPC signatures.

- [ ] **Step 2.5: Run tests + type-check**

```bash
pnpm test:run
pnpm type-check
pnpm lint
```

Expected:
- `pnpm test:run` — 187 tests still pass (frontend hasn't been touched yet, only schema).
- `pnpm type-check` — clean. The new enum member doesn't break any existing usage because existing code only references `'owner'` and `'editor'` literals.
- `pnpm lint` — at the 12-error baseline.

- [ ] **Step 2.6: Commit**

```bash
git add supabase/migrations/20260527130001_role_management_policies.sql src/types/supabase.ts
git commit -m "$(cat <<'EOF'
feat(db): RLS policies + RPCs for the contributor role tier

Rewrites has_event_role with a three-tier case statement. Splits
tents_editor_write into separate INSERT/UPDATE/DELETE policies so
contributors can UPDATE but not INSERT/DELETE. Lowers tent_photos,
tent_categories, and storage-bucket policies to 'contributor' min_role.
Extends handle_new_user to read invite metadata. Adds two SECURITY
DEFINER RPCs: get_event_permissions(eid) returns the four UI-gate
booleans; get_event_users(eid) returns the owner-only user list.

Regenerates src/types/supabase.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Edge Function `invite-user`

**Files:**
- Create: `supabase/functions/invite-user/index.ts`
- Create: `supabase/functions/invite-user/README.md`

- [ ] **Step 3.1: Initialize the function directory**

```bash
pnpm supabase functions new invite-user
```

This creates `supabase/functions/invite-user/index.ts` with a Deno scaffold (Hello-World-style). We'll replace it next.

- [ ] **Step 3.2: Write the function code**

Replace the entire content of `supabase/functions/invite-user/index.ts` with:

```ts
// Supabase Edge Function: invite-user
// Sends a magic-link invitation email and stages the new user's event_admins
// row via the invited_event_id / invited_role metadata that handle_new_user
// reads on trigger fire. Caller must be the event's Owner (or a global admin).
//
// Usage:
//   POST /functions/v1/invite-user
//   Headers: Authorization: Bearer <user-jwt>, Content-Type: application/json
//   Body:    { email, event_id, role_in_event, resend? }
//
// See supabase/functions/invite-user/README.md for deploy + local-test.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Role = 'owner' | 'editor' | 'contributor';

interface InviteBody {
  email?: string;
  event_id?: string;
  role_in_event?: Role;
  resend?: boolean;
}

const ROLES: Role[] = ['owner', 'editor', 'contributor'];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
    },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // Parse body
  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  const { email, event_id, role_in_event, resend } = body;
  if (!email || !event_id || !role_in_event) {
    return jsonResponse({ error: 'missing_fields', message: 'email, event_id, role_in_event required' }, 400);
  }
  if (!ROLES.includes(role_in_event)) {
    return jsonResponse({ error: 'invalid_role' }, 400);
  }

  // Extract caller JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'unauthenticated' }, 401);
  }
  const userJwt = authHeader.slice('Bearer '.length);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Caller-scoped client (RLS active, JWT identifies the caller)
  const callerClient: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });

  // Service-role client (bypasses RLS — used for admin auth API + listUsers)
  const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  // 1. Confirm caller is authenticated
  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'unauthenticated', message: userErr?.message }, 401);
  }

  // 2. Authorize: caller must be owner (or global admin)
  const { data: perms, error: permsErr } = await callerClient
    .rpc('get_event_permissions', { eid: event_id })
    .single();
  if (permsErr) {
    return jsonResponse({ error: 'permission_check_failed', message: permsErr.message }, 500);
  }
  // The RPC returns one row; the .single() typing exposes its columns.
  const canOwn = (perms as { can_own?: boolean } | null)?.can_own === true;
  if (!canOwn) {
    return jsonResponse({ error: 'not_event_owner' }, 403);
  }

  // 3. Check existing user by email
  const { data: usersData, error: listErr } = await serviceClient.auth.admin.listUsers();
  if (listErr) {
    return jsonResponse({ error: 'list_users_failed', message: listErr.message }, 500);
  }
  const existingUser = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    // 3a. Existing user — check current membership in this event
    const { data: membership, error: memErr } = await serviceClient
      .from('event_admins')
      .select('role_in_event')
      .eq('event_id', event_id)
      .eq('profile_id', existingUser.id)
      .maybeSingle();
    if (memErr) {
      return jsonResponse({ error: 'membership_check_failed', message: memErr.message }, 500);
    }
    if (membership) {
      return jsonResponse({
        error: 'already_member',
        existing_role: membership.role_in_event,
        message: `User ${email} already has role '${membership.role_in_event}' in this event.`,
      }, 400);
    }
    // Add the missing event_admins row. No new auth invite, no email.
    const { error: insErr } = await serviceClient
      .from('event_admins')
      .insert({ event_id, profile_id: existingUser.id, role_in_event });
    if (insErr) {
      return jsonResponse({ error: 'insert_event_admin_failed', message: insErr.message }, 500);
    }
    return jsonResponse({ ok: true, user_id: existingUser.id, status: 'added_to_existing_user' });
  }

  // 3b. No existing user. Optionally resend (regenerate magic link instead of fresh invite).
  if (resend) {
    return jsonResponse({ error: 'no_existing_user_to_resend' }, 400);
  }

  // 4. New invitation — embed event/role in metadata so handle_new_user picks it up
  const { data: inviteData, error: inviteErr } = await serviceClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        invited_event_id: event_id,
        invited_role: role_in_event,
      },
    },
  );
  if (inviteErr) {
    return jsonResponse({ error: 'invite_failed', message: inviteErr.message }, 500);
  }

  return jsonResponse({
    ok: true,
    user_id: inviteData.user?.id ?? null,
    status: 'invited',
  });
});
```

- [ ] **Step 3.3: Write the README**

Replace `supabase/functions/invite-user/README.md` with:

```markdown
# invite-user Edge Function

Sends a Supabase Auth magic-link invitation email and stages the new user's
per-event role via metadata that the `handle_new_user` trigger reads on confirm.

## Local development

```bash
# Start local Supabase + functions runtime
pnpm supabase start
pnpm supabase functions serve invite-user --no-verify-jwt
```

The function listens on `http://localhost:54321/functions/v1/invite-user`.

### Local test (curl)

You'll need a JWT for an authenticated user. Easiest path: log in via the app
locally and grab the JWT from `localStorage.getItem('supabase.auth.token')`.

```bash
USER_JWT='<paste-token-here>'
curl -X POST 'http://localhost:54321/functions/v1/invite-user' \
  -H "Authorization: Bearer $USER_JWT" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "newcontributor@example.com",
    "event_id": "<event-uuid>",
    "role_in_event": "contributor"
  }'
```

Expected success: `{ "ok": true, "user_id": "<uuid>", "status": "invited" }`.

The invited user receives an email via Supabase's local Inbucket
(`http://localhost:54324`); click the magic link to confirm and set a password.

## Deploy to production

```bash
pnpm supabase functions deploy invite-user
```

The Supabase CLI uploads the function to the linked project and injects the
production `SUPABASE_SERVICE_ROLE_KEY` automatically. No manual env-var
configuration is needed.

After deploy, the function lives at:
`https://<project-ref>.supabase.co/functions/v1/invite-user`

## Permissions model

The function authenticates the caller via the `Authorization: Bearer <JWT>`
header. It then calls `get_event_permissions(event_id)` using the caller's JWT
to check that `can_own === true`. Only event-owners and global admins can
invite. Anyone else gets a 403.

The function uses the service-role key ONLY for the `auth.admin` API calls
(`listUsers`, `inviteUserByEmail`). It never echoes the service role back to
the caller and never accepts it in the request body.

## Response codes

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ ok, user_id, status: 'invited' }` | New invitation sent. |
| 200 | `{ ok, user_id, status: 'added_to_existing_user' }` | User already had an account; added to this event without a new email. |
| 400 | `{ error: 'missing_fields' / 'invalid_role' / 'invalid_json' }` | Bad request body. |
| 400 | `{ error: 'already_member', existing_role }` | This email already has a role in this event. |
| 401 | `{ error: 'unauthenticated' }` | Missing or invalid JWT. |
| 403 | `{ error: 'not_event_owner' }` | Caller is not Owner / global admin. |
| 500 | `{ error: 'invite_failed' / 'list_users_failed' / ... }` | Server-side Supabase API error. |
```

- [ ] **Step 3.4: Verify the function compiles + serves locally**

```bash
pnpm supabase functions serve invite-user --no-verify-jwt
```

Expected: function starts listening; no Deno parse errors. Hit `Ctrl+C` to stop.

- [ ] **Step 3.5: Commit**

```bash
git add supabase/functions/invite-user/
git commit -m "$(cat <<'EOF'
feat(functions): invite-user Edge Function for magic-link invitations

Authenticates the caller's JWT, checks they have can_own on the event,
then either adds an existing user to event_admins directly OR calls
auth.admin.inviteUserByEmail with metadata that handle_new_user uses to
auto-create the event_admins row on first sign-in. Service-role key
stays server-side; the function never accepts it from the client.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `useEventPermissions` hook

**Files:**
- Create: `src/hooks/useEventPermissions.ts`
- Create: `tests/unit/hooks/useEventPermissions.test.ts`

- [ ] **Step 4.1: Write the failing test**

Create `tests/unit/hooks/useEventPermissions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEventPermissions } from '../../../src/hooks/useEventPermissions';

const rpcSingle = vi.fn();
const rpc = vi.fn().mockReturnValue({ single: rpcSingle });

vi.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

describe('useEventPermissions', () => {
  beforeEach(() => {
    rpc.mockClear();
    rpcSingle.mockReset();
  });

  it('returns loading=true initially', () => {
    rpcSingle.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useEventPermissions('event-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.canAccess).toBe(false);
    expect(result.current.canContribute).toBe(false);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canOwn).toBe(false);
  });

  it('returns all four booleans true for a global admin / owner', async () => {
    rpcSingle.mockResolvedValue({
      data: { can_access: true, can_contribute: true, can_edit: true, can_own: true },
      error: null,
    });
    const { result } = renderHook(() => useEventPermissions('event-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAccess).toBe(true);
    expect(result.current.canContribute).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canOwn).toBe(true);
  });

  it('returns canOwn=false for an editor', async () => {
    rpcSingle.mockResolvedValue({
      data: { can_access: true, can_contribute: true, can_edit: true, can_own: false },
      error: null,
    });
    const { result } = renderHook(() => useEventPermissions('event-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOwn).toBe(false);
    expect(result.current.canEdit).toBe(true);
  });

  it('returns canEdit=false and canOwn=false for a contributor', async () => {
    rpcSingle.mockResolvedValue({
      data: { can_access: true, can_contribute: true, can_edit: false, can_own: false },
      error: null,
    });
    const { result } = renderHook(() => useEventPermissions('event-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAccess).toBe(true);
    expect(result.current.canContribute).toBe(true);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canOwn).toBe(false);
  });

  it('returns all booleans false for a non-member', async () => {
    rpcSingle.mockResolvedValue({
      data: { can_access: false, can_contribute: false, can_edit: false, can_own: false },
      error: null,
    });
    const { result } = renderHook(() => useEventPermissions('event-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAccess).toBe(false);
  });

  it('returns all false and stops loading when eventId is undefined', async () => {
    const { result } = renderHook(() => useEventPermissions(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canAccess).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4.2: Run the tests, verify they fail**

```bash
pnpm test:run tests/unit/hooks/useEventPermissions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement the hook**

Create `src/hooks/useEventPermissions.ts`:

```ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface EventPermissions {
  loading: boolean;
  canAccess: boolean;
  canContribute: boolean;
  canEdit: boolean;
  canOwn: boolean;
}

const ALL_FALSE: Omit<EventPermissions, 'loading'> = {
  canAccess: false,
  canContribute: false,
  canEdit: false,
  canOwn: false,
};

/**
 * Resolves the four event-scoped permission booleans for the current caller.
 * Calls `rpc('get_event_permissions', { eid })`. Falls back to all-false when
 * eventId is undefined or the RPC errors (defensive — RLS is the real gate).
 */
export function useEventPermissions(eventId: string | undefined): EventPermissions {
  const [state, setState] = useState<EventPermissions>({ ...ALL_FALSE, loading: true });

  useEffect(() => {
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs state when input becomes falsy. Long-term: TanStack Query.
      setState({ ...ALL_FALSE, loading: false });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));
    supabase
      .rpc('get_event_permissions', { eid: eventId })
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState({ ...ALL_FALSE, loading: false });
          return;
        }
        const row = data as {
          can_access: boolean;
          can_contribute: boolean;
          can_edit: boolean;
          can_own: boolean;
        };
        setState({
          loading: false,
          canAccess: row.can_access,
          canContribute: row.can_contribute,
          canEdit: row.can_edit,
          canOwn: row.can_own,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return state;
}
```

- [ ] **Step 4.4: Run the tests, verify they pass**

```bash
pnpm test:run tests/unit/hooks/useEventPermissions.test.ts
```

Expected: PASS — 6 tests green.

- [ ] **Step 4.5: Type-check + lint**

```bash
pnpm type-check
pnpm lint
```

Expected: clean (baseline preserved).

- [ ] **Step 4.6: Commit**

```bash
git add src/hooks/useEventPermissions.ts tests/unit/hooks/useEventPermissions.test.ts
git commit -m "feat(hooks): useEventPermissions returns the 4 event-scoped booleans"
```

---

## Task 5 — `RequireEventRole` route guard

**Files:**
- Create: `src/components/RequireEventRole.tsx`
- Create: `tests/unit/components/RequireEventRole.test.tsx`

- [ ] **Step 5.1: Write the failing test**

Create `tests/unit/components/RequireEventRole.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireEventRole } from '../../../src/components/RequireEventRole';

const permissionsState = vi.fn();
vi.mock('../../../src/hooks/useEventPermissions', () => ({
  useEventPermissions: (...args: unknown[]) => permissionsState(...args),
}));

const eventState = vi.fn();
vi.mock('../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => eventState(...args),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/events/:eventSlug/protected"
          element={
            <RequireEventRole minRole="editor">
              <div>protected content</div>
            </RequireEventRole>
          }
        />
        <Route path="/admin/events/:eventSlug/tents" element={<div>redirect target</div>} />
        <Route path="/admin/no-access" element={<div>no-access page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireEventRole', () => {
  beforeEach(() => {
    permissionsState.mockReset();
    eventState.mockReset();
  });

  it('renders a loading state while event or permissions are still loading', () => {
    eventState.mockReturnValue({ event: null, loading: true, error: null });
    permissionsState.mockReturnValue({ loading: true, canAccess: false, canContribute: false, canEdit: false, canOwn: false });
    renderAt('/admin/events/foo/protected');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    // Either a spinner or a placeholder is acceptable; assert that the children are not yet rendered.
  });

  it('renders children when the caller meets the minRole', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo' }, loading: false, error: null });
    permissionsState.mockReturnValue({ loading: false, canAccess: true, canContribute: true, canEdit: true, canOwn: false });
    renderAt('/admin/events/foo/protected');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects to /admin/events/:slug/tents when the caller lacks the minRole but can access the event', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo' }, loading: false, error: null });
    permissionsState.mockReturnValue({ loading: false, canAccess: true, canContribute: true, canEdit: false, canOwn: false });
    renderAt('/admin/events/foo/protected');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByText('redirect target')).toBeInTheDocument();
  });

  it('redirects to /admin/no-access when the caller has no access to the event at all', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo' }, loading: false, error: null });
    permissionsState.mockReturnValue({ loading: false, canAccess: false, canContribute: false, canEdit: false, canOwn: false });
    renderAt('/admin/events/foo/protected');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByText('no-access page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2: Run the tests, verify they fail**

```bash
pnpm test:run tests/unit/components/RequireEventRole.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement `RequireEventRole`**

Create `src/components/RequireEventRole.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useEvent } from '../hooks/useEvent';
import { useEventPermissions, type EventPermissions } from '../hooks/useEventPermissions';

type MinRole = 'contributor' | 'editor' | 'owner';

interface Props {
  minRole: MinRole;
  children: ReactNode;
}

function meets(perms: EventPermissions, minRole: MinRole): boolean {
  if (minRole === 'contributor') return perms.canContribute;
  if (minRole === 'editor') return perms.canEdit;
  return perms.canOwn;
}

/**
 * Route-guard wrapper. Reads :eventSlug from the URL, resolves to an event id
 * via useEvent, then calls useEventPermissions and checks the requested
 * minRole. Renders a tiny placeholder while loading, redirects with
 * <Navigate> when access is denied, otherwise renders children.
 *
 * NOTE: UI gate only. The RLS policies enforce the same rule server-side —
 * any attempt to bypass this component still fails at the DB.
 */
export function RequireEventRole({ minRole, children }: Props) {
  const { eventSlug } = useParams<{ eventSlug?: string }>();
  const { event, loading: eventLoading } = useEvent(eventSlug);
  const perms = useEventPermissions(event?.id);

  if (eventLoading || perms.loading) {
    return <p className="p-6">…</p>;
  }

  if (!perms.canAccess) {
    return <Navigate to="/admin/no-access" replace />;
  }
  if (!meets(perms, minRole)) {
    return <Navigate to={`/admin/events/${eventSlug}/tents`} replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 5.4: Run the tests, verify they pass**

```bash
pnpm test:run tests/unit/components/RequireEventRole.test.tsx
```

Expected: PASS — 4 tests green.

- [ ] **Step 5.5: Type-check + lint + full suite**

```bash
pnpm test:run
pnpm type-check
pnpm lint
```

Expected: 187 + 6 (T4) + 4 (T5) = 197 tests. Type-check clean. Lint baseline preserved.

- [ ] **Step 5.6: Commit**

```bash
git add src/components/RequireEventRole.tsx tests/unit/components/RequireEventRole.test.tsx
git commit -m "feat(viewer): RequireEventRole route guard with min_role check"
```

---

## Task 6 — User-management UI: `useEventUsers` + `UserRow` + `InviteUserForm` + `UsersPage`

**Files (created together as one task, four sub-files):**
- Create: `src/hooks/useEventUsers.ts`
- Create: `src/components/UserRow.tsx`
- Create: `src/components/InviteUserForm.tsx`
- Create: `src/pages/admin/UsersPage.tsx`
- Create: `tests/unit/components/UserRow.test.tsx`
- Create: `tests/unit/components/InviteUserForm.test.tsx`
- Create: `tests/unit/pages/admin/UsersPage.test.tsx`
- Modify: `src/locales/de/common.json`, `src/locales/en/common.json` (i18n keys for the page + components)

This is the largest task. Six new source files + three test files + i18n. Do it in sub-commits per sub-file pair.

### Step 6.1 — i18n keys (do this first so the components can reference them)

- [ ] Open `src/locales/de/common.json`. In the `admin` block, ADD a new `users` sub-block (keep alphabetical/grouped ordering with existing admin sub-blocks):

```jsonc
{
  "admin": {
    "nav": {
      "view_site": "Zur Karte",
      "dashboard": "Dashboard",
      "events": "Events",
      "sign_out": "Abmelden",
      "sign_out_failed": "Abmelden fehlgeschlagen: {{message}}",
      "skip_to_main": "Zum Hauptinhalt springen",
      "users": "Benutzer"
    },
    // …existing sub-blocks…
    "users": {
      "heading": "Benutzer — {{title}}",
      "invite_heading": "Neuen Benutzer einladen",
      "invite_email_label": "Email",
      "invite_role_label": "Rolle",
      "role_owner": "Owner",
      "role_editor": "Editor",
      "role_contributor": "Contributor",
      "invite_submit": "Einladung senden",
      "invite_sending": "Senden …",
      "invite_success": "Einladung an {{email}} versandt.",
      "invite_added_to_existing": "{{email}} wurde als {{role}} hinzugefügt (bestehender Account).",
      "invite_already_member": "{{email}} ist bereits Mitglied dieses Events ({{role}}).",
      "invite_error": "Einladung fehlgeschlagen: {{message}}",
      "list_heading": "Aktuelle Benutzer",
      "col_email": "Email",
      "col_role": "Rolle",
      "col_actions": "Aktionen",
      "action_remove": "Entfernen",
      "action_confirm_remove": "Klick zum Bestätigen",
      "action_resend_invite": "Erneut senden",
      "you_label": "Du selbst",
      "pending_prefix": "(Pending)",
      "empty": "Lade Mitstreiter ein, indem du oben eine Email einträgst."
    }
  }
}
```

- [ ] Open `src/locales/en/common.json`. Mirror the same structure with English values:

```jsonc
{
  "admin": {
    "nav": {
      // …existing keys…
      "users": "Users"
    },
    "users": {
      "heading": "Users — {{title}}",
      "invite_heading": "Invite new user",
      "invite_email_label": "Email",
      "invite_role_label": "Role",
      "role_owner": "Owner",
      "role_editor": "Editor",
      "role_contributor": "Contributor",
      "invite_submit": "Send invitation",
      "invite_sending": "Sending…",
      "invite_success": "Invitation sent to {{email}}.",
      "invite_added_to_existing": "{{email}} added as {{role}} (existing account).",
      "invite_already_member": "{{email}} is already a member of this event ({{role}}).",
      "invite_error": "Invitation failed: {{message}}",
      "list_heading": "Current users",
      "col_email": "Email",
      "col_role": "Role",
      "col_actions": "Actions",
      "action_remove": "Remove",
      "action_confirm_remove": "Click to confirm",
      "action_resend_invite": "Resend",
      "you_label": "You",
      "pending_prefix": "(Pending)",
      "empty": "Invite collaborators by entering an email above."
    }
  }
}
```

- [ ] **Commit i18n**:
```bash
git add src/locales/de/common.json src/locales/en/common.json
git commit -m "feat(i18n): user-management strings (admin.users.* + admin.nav.users)"
```

### Step 6.2 — `useEventUsers` hook

- [ ] Create `src/hooks/useEventUsers.ts`:

```ts
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface EventUser {
  profileId: string;
  email: string;
  fullName: string | null;
  roleInEvent: 'owner' | 'editor' | 'contributor';
  emailConfirmedAt: string | null;
  invitedAt: string;
}

interface UseEventUsersResult {
  users: EventUser[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useEventUsers(eventId: string | undefined): UseEventUsersResult {
  const [users, setUsers] = useState<EventUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs state when input becomes falsy. Long-term: TanStack Query.
      setUsers([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .rpc('get_event_users', { eid: eventId })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(new Error(err.message));
          setUsers([]);
        } else {
          const rows = (data ?? []) as Array<{
            profile_id: string;
            email: string;
            full_name: string | null;
            role_in_event: 'owner' | 'editor' | 'contributor';
            email_confirmed_at: string | null;
            invited_at: string;
          }>;
          setUsers(
            rows.map((r) => ({
              profileId: r.profile_id,
              email: r.email,
              fullName: r.full_name,
              roleInEvent: r.role_in_event,
              emailConfirmedAt: r.email_confirmed_at,
              invitedAt: r.invited_at,
            })),
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, tick]);

  return { users, loading, error, refetch };
}
```

- [ ] **Commit**:
```bash
git add src/hooks/useEventUsers.ts
git commit -m "feat(hooks): useEventUsers fetches the per-event user list via RPC"
```

### Step 6.3 — `UserRow` component + tests

- [ ] Create `tests/unit/components/UserRow.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../src/lib/i18n';
import { UserRow } from '../../../src/components/UserRow';
import type { EventUser } from '../../../src/hooks/useEventUsers';

const sampleUser: EventUser = {
  profileId: 'p-1',
  email: 'helga@example.com',
  fullName: 'Helga',
  roleInEvent: 'editor',
  emailConfirmedAt: '2026-05-20T10:00:00Z',
  invitedAt: '2026-05-19T10:00:00Z',
};

describe('UserRow', () => {
  let onChangeRole: ReturnType<typeof vi.fn>;
  let onRemove: ReturnType<typeof vi.fn>;
  let onResendInvite: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onChangeRole = vi.fn();
    onRemove = vi.fn();
    onResendInvite = vi.fn();
  });

  it('renders email and current role', () => {
    render(
      <table><tbody>
        <UserRow user={sampleUser} isSelf={false} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    expect(screen.getByText('helga@example.com')).toBeInTheDocument();
  });

  it('shows the "you" label and disables actions when isSelf=true', () => {
    render(
      <table><tbody>
        <UserRow user={sampleUser} isSelf={true} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    expect(screen.getByText(/Du selbst|You/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entfernen|Remove/i })).not.toBeInTheDocument();
  });

  it('calls onChangeRole when the dropdown value changes', () => {
    render(
      <table><tbody>
        <UserRow user={sampleUser} isSelf={false} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    fireEvent.change(screen.getByRole('combobox', { name: /Rolle|Role/i }), { target: { value: 'contributor' } });
    expect(onChangeRole).toHaveBeenCalledWith('p-1', 'contributor');
  });

  it('uses a two-click confirm pattern for remove', () => {
    render(
      <table><tbody>
        <UserRow user={sampleUser} isSelf={false} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    // First click: shifts to confirm state, does NOT call onRemove yet.
    fireEvent.click(screen.getByRole('button', { name: /Entfernen|Remove/i }));
    expect(onRemove).not.toHaveBeenCalled();
    // Second click on the confirm button: invokes onRemove.
    fireEvent.click(screen.getByRole('button', { name: /Klick zum Bestätigen|Click to confirm/i }));
    expect(onRemove).toHaveBeenCalledWith('p-1');
  });

  it('shows "(Pending)" + "Resend" for unconfirmed users', () => {
    const pending: EventUser = { ...sampleUser, emailConfirmedAt: null };
    render(
      <table><tbody>
        <UserRow user={pending} isSelf={false} onChangeRole={onChangeRole} onRemove={onRemove} onResendInvite={onResendInvite} />
      </tbody></table>,
    );
    expect(screen.getByText(/\(Pending\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Erneut senden|Resend/i }));
    expect(onResendInvite).toHaveBeenCalledWith('helga@example.com');
  });
});
```

- [ ] Run the test — expect FAIL.

- [ ] Create `src/components/UserRow.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventUser } from '../hooks/useEventUsers';

interface Props {
  user: EventUser;
  isSelf: boolean;
  onChangeRole: (profileId: string, newRole: 'owner' | 'editor' | 'contributor') => void;
  onRemove: (profileId: string) => void;
  onResendInvite: (email: string) => void;
}

export function UserRow({ user, isSelf, onChangeRole, onRemove, onResendInvite }: Props) {
  const { t } = useTranslation();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const isPending = user.emailConfirmedAt == null;

  return (
    <tr className="border-b border-white/5">
      <td className="py-2">
        {isPending && <span className="mr-1 text-white/50">{t('admin.users.pending_prefix')}</span>}
        {user.email}
      </td>
      <td>
        {isSelf ? (
          <span className="text-white/60">{t(`admin.users.role_${user.roleInEvent}`)}</span>
        ) : (
          <select
            aria-label={t('admin.users.col_role')}
            value={user.roleInEvent}
            onChange={(e) => onChangeRole(user.profileId, e.target.value as 'owner' | 'editor' | 'contributor')}
            className="input"
          >
            <option value="contributor">{t('admin.users.role_contributor')}</option>
            <option value="editor">{t('admin.users.role_editor')}</option>
            <option value="owner">{t('admin.users.role_owner')}</option>
          </select>
        )}
      </td>
      <td className="space-x-3">
        {isSelf ? (
          <span className="text-white/60">{t('admin.users.you_label')}</span>
        ) : isPending ? (
          <button type="button" onClick={() => onResendInvite(user.email)} className="underline">
            {t('admin.users.action_resend_invite')}
          </button>
        ) : confirmingRemove ? (
          <button
            type="button"
            onClick={() => {
              onRemove(user.profileId);
              setConfirmingRemove(false);
            }}
            className="text-red-400"
          >
            {t('admin.users.action_confirm_remove')}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmingRemove(true)} className="text-red-400">
            {t('admin.users.action_remove')}
          </button>
        )}
      </td>
    </tr>
  );
}
```

- [ ] Run the test — expect PASS (5 tests).

- [ ] **Commit**:
```bash
git add src/components/UserRow.tsx tests/unit/components/UserRow.test.tsx
git commit -m "feat(admin): UserRow with role dropdown, two-click remove, pending state"
```

### Step 6.4 — `InviteUserForm` component + tests

- [ ] Create `tests/unit/components/InviteUserForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../../src/lib/i18n';
import { InviteUserForm } from '../../../src/components/InviteUserForm';

const functionsInvoke = vi.fn();
vi.mock('../../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) } },
}));

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showSuccess, showError }),
}));

describe('InviteUserForm', () => {
  let onInvited: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    functionsInvoke.mockReset();
    showSuccess.mockReset();
    showError.mockReset();
    onInvited = vi.fn();
  });

  it('does not submit when email is empty', () => {
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    expect(functionsInvoke).not.toHaveBeenCalled();
  });

  it('calls the Edge Function with email + event_id + role_in_event on submit', async () => {
    functionsInvoke.mockResolvedValue({ data: { ok: true, user_id: 'new-uid', status: 'invited' }, error: null });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    await waitFor(() => expect(functionsInvoke).toHaveBeenCalled());
    expect(functionsInvoke).toHaveBeenCalledWith('invite-user', {
      body: { email: 'new@example.com', event_id: 'ev1', role_in_event: 'contributor' },
    });
    await waitFor(() => expect(showSuccess).toHaveBeenCalled());
    expect(onInvited).toHaveBeenCalled();
  });

  it('shows an error toast when the Edge Function returns already_member', async () => {
    functionsInvoke.mockResolvedValue({ data: { error: 'already_member', existing_role: 'editor' }, error: null });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'existing@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    await waitFor(() => expect(showError).toHaveBeenCalled());
    expect(onInvited).not.toHaveBeenCalled();
  });

  it('shows an error toast on network/server error', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    render(<InviteUserForm eventId="ev1" onInvited={onInvited} />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Einladung senden|Send invitation/i }));
    await waitFor(() => expect(showError).toHaveBeenCalled());
  });
});
```

- [ ] Run the test — expect FAIL.

- [ ] Create `src/components/InviteUserForm.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

type Role = 'contributor' | 'editor' | 'owner';

interface Props {
  eventId: string;
  onInvited: () => void;
}

interface InviteResponse {
  ok?: boolean;
  user_id?: string | null;
  status?: 'invited' | 'added_to_existing_user';
  error?: string;
  existing_role?: Role;
  message?: string;
}

export function InviteUserForm({ eventId, onInvited }: Props) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('contributor');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), event_id: eventId, role_in_event: role },
      });
      const result = (data ?? {}) as InviteResponse;
      if (error) {
        showError(t('admin.users.invite_error', { message: error.message }));
        return;
      }
      if (result.error === 'already_member') {
        showError(t('admin.users.invite_already_member', { email: email.trim(), role: result.existing_role ?? '' }));
        return;
      }
      if (result.error) {
        showError(t('admin.users.invite_error', { message: result.message ?? result.error }));
        return;
      }
      if (result.status === 'added_to_existing_user') {
        showSuccess(t('admin.users.invite_added_to_existing', { email: email.trim(), role }));
      } else {
        showSuccess(t('admin.users.invite_success', { email: email.trim() }));
      }
      setEmail('');
      onInvited();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-4 rounded border border-white/10 p-3">
      <h2 className="mb-2 text-sm font-semibold">{t('admin.users.invite_heading')}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block text-xs">
          <span className="block text-white/60">{t('admin.users.invite_email_label')}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1"
            aria-label={t('admin.users.invite_email_label')}
          />
        </label>
        <label className="block text-xs">
          <span className="block text-white/60">{t('admin.users.invite_role_label')}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input mt-1">
            <option value="contributor">{t('admin.users.role_contributor')}</option>
            <option value="editor">{t('admin.users.role_editor')}</option>
            <option value="owner">{t('admin.users.role_owner')}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-end rounded bg-white/20 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy ? t('admin.users.invite_sending') : t('admin.users.invite_submit')}
        </button>
      </div>
    </form>
  );
}
```

- [ ] Run the test — expect PASS (4 tests).

- [ ] **Commit**:
```bash
git add src/components/InviteUserForm.tsx tests/unit/components/InviteUserForm.test.tsx
git commit -m "feat(admin): InviteUserForm calls the invite-user Edge Function"
```

### Step 6.5 — `UsersPage` + tests

- [ ] Create `tests/unit/pages/admin/UsersPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../../../../src/lib/i18n';

const eventState = vi.fn();
vi.mock('../../../../src/hooks/useEvent', () => ({
  useEvent: (...args: unknown[]) => eventState(...args),
}));

const usersState = vi.fn();
vi.mock('../../../../src/hooks/useEventUsers', () => ({
  useEventUsers: (...args: unknown[]) => usersState(...args),
}));

const authState = vi.fn();
vi.mock('../../../../src/components/AuthProvider', () => ({
  useAuth: () => authState(),
}));

vi.mock('../../../../src/components/ToastProvider', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const supabaseUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
const supabaseDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ update: supabaseUpdate, delete: supabaseDelete }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) },
  },
}));

import UsersPage from '../../../../src/pages/admin/UsersPage';

function renderUsersPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/events/foo/users']}>
      <Routes>
        <Route path="/admin/events/:eventSlug/users" element={<UsersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UsersPage', () => {
  beforeEach(() => {
    eventState.mockReset();
    usersState.mockReset();
    authState.mockReset();
  });

  it('renders heading + invite form + user list when event and users are loaded', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo', title_de: 'Kunstmeile' }, loading: false, error: null });
    authState.mockReturnValue({ session: { user: { id: 'p-1' } } });
    usersState.mockReturnValue({
      users: [
        { profileId: 'p-1', email: 'me@example.com', fullName: 'Me', roleInEvent: 'owner', emailConfirmedAt: '2026-01-01', invitedAt: '2025-12-01' },
        { profileId: 'p-2', email: 'helga@example.com', fullName: 'Helga', roleInEvent: 'editor', emailConfirmedAt: '2026-02-01', invitedAt: '2026-01-15' },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderUsersPage();
    expect(screen.getByText(/Benutzer — Kunstmeile|Users — Kunstmeile/i)).toBeInTheDocument();
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByText('helga@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Einladung senden|Send invitation/i })).toBeInTheDocument();
  });

  it('marks the current user as "Du selbst" / "You" and hides the remove button on their row', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo', title_de: 'Kunstmeile' }, loading: false, error: null });
    authState.mockReturnValue({ session: { user: { id: 'p-1' } } });
    usersState.mockReturnValue({
      users: [{ profileId: 'p-1', email: 'me@example.com', fullName: 'Me', roleInEvent: 'owner', emailConfirmedAt: '2026-01-01', invitedAt: '2025-12-01' }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderUsersPage();
    expect(screen.getByText(/Du selbst|You/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entfernen|Remove/i })).not.toBeInTheDocument();
  });

  it('renders the empty-state hint when only the current user exists', () => {
    eventState.mockReturnValue({ event: { id: 'ev1', slug: 'foo', title_de: 'Kunstmeile' }, loading: false, error: null });
    authState.mockReturnValue({ session: { user: { id: 'p-1' } } });
    usersState.mockReturnValue({
      users: [{ profileId: 'p-1', email: 'me@example.com', fullName: 'Me', roleInEvent: 'owner', emailConfirmedAt: '2026-01-01', invitedAt: '2025-12-01' }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderUsersPage();
    expect(screen.getByText(/Lade Mitstreiter ein|Invite collaborators/i)).toBeInTheDocument();
  });
});
```

- [ ] Run the test — expect FAIL.

- [ ] Create `src/pages/admin/UsersPage.tsx`:

```tsx
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../hooks/useEvent';
import { useEventUsers } from '../../hooks/useEventUsers';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/ToastProvider';
import { InviteUserForm } from '../../components/InviteUserForm';
import { UserRow } from '../../components/UserRow';

type Role = 'contributor' | 'editor' | 'owner';

export default function UsersPage() {
  const { t } = useTranslation();
  const { eventSlug } = useParams();
  const { event } = useEvent(eventSlug);
  const { users, loading, refetch } = useEventUsers(event?.id);
  const { session } = useAuth();
  const { showSuccess, showError } = useToast();

  if (!event) return <p className="p-6">…</p>;

  const myProfileId = session?.user?.id ?? null;
  const onlySelf = users.length === 1 && users[0]?.profileId === myProfileId;

  async function onChangeRole(profileId: string, newRole: Role) {
    if (!event) return;
    const { error } = await supabase
      .from('event_admins')
      .update({ role_in_event: newRole })
      .eq('event_id', event.id)
      .eq('profile_id', profileId);
    if (error) {
      showError(`Update failed: ${error.message}`);
      return;
    }
    refetch();
  }

  async function onRemove(profileId: string) {
    if (!event) return;
    const { error } = await supabase
      .from('event_admins')
      .delete()
      .eq('event_id', event.id)
      .eq('profile_id', profileId);
    if (error) {
      showError(`Remove failed: ${error.message}`);
      return;
    }
    refetch();
  }

  async function onResendInvite(email: string) {
    if (!event) return;
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, event_id: event.id, role_in_event: 'contributor', resend: true },
    });
    const r = (data ?? {}) as { error?: string; message?: string };
    if (error || r.error) {
      showError(`Resend failed: ${error?.message ?? r.message ?? r.error}`);
      return;
    }
    showSuccess(t('admin.users.invite_success', { email }));
  }

  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold">
        {t('admin.users.heading', { title: event.title_de })}
      </h1>

      <InviteUserForm eventId={event.id} onInvited={refetch} />

      <h2 className="mb-2 text-sm font-semibold text-white/80">{t('admin.users.list_heading')}</h2>

      {loading ? (
        <p>…</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs text-white/60">
              <tr>
                <th className="py-2">{t('admin.users.col_email')}</th>
                <th>{t('admin.users.col_role')}</th>
                <th>{t('admin.users.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.profileId}
                  user={u}
                  isSelf={u.profileId === myProfileId}
                  onChangeRole={onChangeRole}
                  onRemove={onRemove}
                  onResendInvite={onResendInvite}
                />
              ))}
            </tbody>
          </table>
          {onlySelf && (
            <p className="mt-3 text-sm text-white/60">{t('admin.users.empty')}</p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] Run the test — expect PASS (3 tests).

- [ ] **Commit**:
```bash
git add src/pages/admin/UsersPage.tsx tests/unit/pages/admin/UsersPage.test.tsx
git commit -m "feat(admin): UsersPage composes invite form + user list + role mutations"
```

---

## Task 7 — UI gates + route guard wiring + AdminLayout nav

**Files:**
- Modify: `src/routes.tsx` (new `/admin/events/:slug/users` route + `RequireEventRole` wrappers on existing admin routes)
- Modify: `src/components/SidePanel.tsx` (swap `useCanEditEvent` → `useEventPermissions.canContribute`)
- Modify: `src/pages/admin/TentListPage.tsx` (gate `+ Neuer Stand` and `CSV-Import` on `canEdit`)
- Modify: `src/pages/admin/AdminLayout.tsx` (conditional `Users` nav-link)
- Modify: `src/hooks/useCanEditEvent.ts` (replace with thin wrapper over `useEventPermissions.canContribute`)
- Modify: `tests/unit/components/SidePanel.test.tsx`, `tests/unit/pages/admin/TentListPage.test.tsx` (extend mocks for `useEventPermissions` and add role-permission assertions)

This is a cross-cutting integration task. Do it in small atomic edits, verifying after each chunk.

### Step 7.1 — Replace `useCanEditEvent` with a wrapper

- [ ] Open `src/hooks/useCanEditEvent.ts`. Replace its full contents with:

```ts
import { useEventPermissions } from './useEventPermissions';

export interface UseCanEditEventResult {
  canEdit: boolean;
  loading: boolean;
  error: Error | null;
}

/**
 * Legacy wrapper preserving the pre-role-management API shape. New code should
 * use `useEventPermissions` directly. The `canEdit` field maps to the new
 * `canContribute` because the old "can edit" gate (photos + tent info) now
 * matches the contributor tier.
 */
export function useCanEditEvent(eventId: string | undefined): UseCanEditEventResult {
  const perms = useEventPermissions(eventId);
  return {
    canEdit: perms.canContribute,
    loading: perms.loading,
    error: null,
  };
}
```

- [ ] Run `pnpm type-check` — should be clean. Existing callers (SidePanel, EventViewPage) keep working.
- [ ] Run `pnpm test:run tests/unit/hooks/` and the SidePanel test to confirm no break.

### Step 7.2 — Add route guards to existing admin routes + new Users route

- [ ] Open `src/routes.tsx`. Add the import:

```tsx
import { RequireEventRole } from './components/RequireEventRole';
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
```

- [ ] Replace the per-event admin routes block with the wrapped versions. Locate this section:

```tsx
{ path: 'events/:eventSlug/tents', element: suspended(<TentListPage />) },
{ path: 'events/:eventSlug/tents/new', element: suspended(<TentEditPage />) },
{ path: 'events/:eventSlug/tents/import', element: suspended(<TentImportPage />) },
{ path: 'events/:eventSlug/tents/:tentId', element: suspended(<TentEditPage />) },
{ path: 'events/:eventSlug/categories', element: suspended(<CategoryListPage />) },
{ path: 'events/:eventSlug/settings', element: suspended(<EventSettingsPage />) },
```

Replace with:

```tsx
{
  path: 'events/:eventSlug/tents',
  element: <RequireEventRole minRole="contributor">{suspended(<TentListPage />)}</RequireEventRole>,
},
{
  path: 'events/:eventSlug/tents/new',
  element: <RequireEventRole minRole="editor">{suspended(<TentEditPage />)}</RequireEventRole>,
},
{
  path: 'events/:eventSlug/tents/import',
  element: <RequireEventRole minRole="editor">{suspended(<TentImportPage />)}</RequireEventRole>,
},
{
  path: 'events/:eventSlug/tents/:tentId',
  element: <RequireEventRole minRole="contributor">{suspended(<TentEditPage />)}</RequireEventRole>,
},
{
  path: 'events/:eventSlug/categories',
  element: <RequireEventRole minRole="editor">{suspended(<CategoryListPage />)}</RequireEventRole>,
},
{
  path: 'events/:eventSlug/settings',
  element: <RequireEventRole minRole="owner">{suspended(<EventSettingsPage />)}</RequireEventRole>,
},
{
  path: 'events/:eventSlug/users',
  element: <RequireEventRole minRole="owner">{suspended(<UsersPage />)}</RequireEventRole>,
},
```

- [ ] Run `pnpm test:run && pnpm type-check && pnpm lint`. Existing tests may need `useEventPermissions` mocks — see Step 7.5.

### Step 7.3 — TentListPage button gates

- [ ] Open `src/pages/admin/TentListPage.tsx`. Add the import:

```tsx
import { useEventPermissions } from '../../hooks/useEventPermissions';
```

- [ ] Inside the component (near other hook calls), add:

```tsx
const perms = useEventPermissions(event?.id);
```

- [ ] In the header `<div className="flex gap-2">`, wrap the existing `CSV-Import` `<Link>` and `+ Neuer Stand` `<Link>` in a conditional:

```tsx
<div className="flex gap-2">
  {/* Excel-Export button stays unchanged — accessible at canAccess */}
  <button /* …existing export button… */ />

  {perms.canEdit && (
    <>
      <Link
        to={`/admin/events/${event.slug}/tents/import`}
        className="rounded bg-white/10 px-3 py-1 text-sm"
      >
        {t('admin.tent_list.csv_import')}
      </Link>
      <Link
        to={`/admin/events/${event.slug}/tents/new`}
        className="rounded bg-white/20 px-3 py-1 text-sm"
      >
        {t('admin.tent_list.new_tent')}
      </Link>
    </>
  )}
</div>
```

> **Note for the engineer:** if `feat/excel-export` hasn't merged yet (PR #29 still open), the Excel-Export button block won't be in `main`'s TentListPage. Either rebase onto main after #29 merges (cleanest) or include both changes when this PR rebases. The role-management plan assumes the export button is present; if not, just gate the two existing links.

### Step 7.4 — SidePanel: swap `useCanEditEvent` → `useEventPermissions`

- [ ] Open `src/components/SidePanel.tsx`. The component receives `canEdit` as a prop, NOT directly via hook. The caller is `EventViewPage`. So this change happens in `EventViewPage`.

- [ ] Open `src/pages/public/EventViewPage.tsx`. Find the `useCanEditEvent(event?.id)` call. Replace with:

```tsx
import { useEventPermissions } from '../../hooks/useEventPermissions';

// in component:
const perms = useEventPermissions(event?.id);
// then change the SidePanel usage:
<SidePanel
  // …other props…
  canEdit={perms.canContribute}
  // …
/>
```

> **Alternative — keep the legacy wrapper:** since we left `useCanEditEvent` as a thin wrapper (Step 7.1), this change is OPTIONAL. The existing caller continues to work. For consistency, prefer migrating but treat this as polish — it isn't required for the feature to ship correctly.

### Step 7.5 — AdminLayout: conditional Users nav link

- [ ] Open `src/pages/admin/AdminLayout.tsx`. Find the nav `<Link>` list.

The AdminLayout doesn't know which event the user is viewing (route may be at `/admin`, `/admin/events`, or `/admin/events/<slug>/...`). Strategy: when the route has an `:eventSlug` param, check that event's `canOwn`. Otherwise skip the Users link.

- [ ] Read the relevant React Router pattern: `useMatch('/admin/events/:eventSlug/*')` returns either a match object with `params.eventSlug` or null. Use that:

```tsx
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { useEvent } from '../../hooks/useEvent';
import { useEventPermissions } from '../../hooks/useEventPermissions';

// in component:
const eventMatch = useMatch('/admin/events/:eventSlug/*');
const eventSlugInRoute = eventMatch?.params?.eventSlug;
const { event: routeEvent } = useEvent(eventSlugInRoute);
const perms = useEventPermissions(routeEvent?.id);
const showUsersLink = perms.canOwn;

// in JSX nav:
{showUsersLink && eventSlugInRoute && (
  <Link to={`/admin/events/${eventSlugInRoute}/users`} className="text-white/70 hover:text-white">
    {t('admin.nav.users')}
  </Link>
)}
```

### Step 7.6 — Extend existing tests for role permissions

- [ ] Open `tests/unit/components/SidePanel.test.tsx`. The test currently passes `canEdit={true|false}` as a prop. No hook mocking is needed since the prop is direct. No change needed unless asserts on the photo-button visibility per role need to be added — defer to manual smoke.

- [ ] Open `tests/unit/pages/admin/TentListPage.test.tsx`. The component now uses `useEventPermissions`. Add a mock at the top:

```tsx
vi.mock('../../../../src/hooks/useEventPermissions', () => ({
  useEventPermissions: () => ({
    loading: false,
    canAccess: true,
    canContribute: true,
    canEdit: true,
    canOwn: false,
  }),
}));
```

Add two new tests covering role-based button visibility:

```tsx
import { useEventPermissions } from '../../../../src/hooks/useEventPermissions';

// In a separate describe block:
describe('TentListPage role-based gating', () => {
  it('hides + Neuer Stand and CSV-Import buttons for a contributor', () => {
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false, canAccess: true, canContribute: true, canEdit: false, canOwn: false,
    });
    // …render…
    expect(screen.queryByRole('link', { name: /Neuer Stand|New tent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /CSV-Import|CSV import/i })).not.toBeInTheDocument();
  });

  it('shows both buttons for an editor', () => {
    vi.mocked(useEventPermissions).mockReturnValue({
      loading: false, canAccess: true, canContribute: true, canEdit: true, canOwn: false,
    });
    // …render…
    expect(screen.getByRole('link', { name: /Neuer Stand|New tent/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /CSV-Import|CSV import/i })).toBeInTheDocument();
  });
});
```

- [ ] Run all tests + type-check + lint:

```bash
pnpm test:run
pnpm type-check
pnpm lint
```

Expected: full suite green. Baseline lint. The new tests add ~2-3 tests; total should be around 200-205.

### Step 7.7 — Commit T7 in one go

```bash
git add src/routes.tsx src/components/SidePanel.tsx src/pages/admin/TentListPage.tsx src/pages/admin/AdminLayout.tsx src/pages/public/EventViewPage.tsx src/hooks/useCanEditEvent.ts tests/unit/pages/admin/TentListPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): UI gates + route guards for contributor role

routes.tsx wraps each admin route with RequireEventRole at the
appropriate min_role tier (contributor for TentListPage and edit-mode
TentEditPage; editor for create/import/categories; owner for settings
and new users page). TentListPage hides + Neuer Stand and CSV-Import
buttons for contributors. AdminLayout conditionally renders the Users
nav link when the current route's event has canOwn=true.
useCanEditEvent kept as a thin wrapper over useEventPermissions.canContribute.
EventViewPage migrated to useEventPermissions for consistency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — Manual smoke + push + PR + user verification

**Files:**
- Create: `tests/manual/role-management-smoke.md`

- [ ] **Step 8.1: Write the manual smoke checklist**

Create `tests/manual/role-management-smoke.md`:

```markdown
# Role Management — Manual Smoke

Run against the Vercel preview for `feat/role-management` (URL pattern:
`kunstmeile-map-git-feat-role-management-kunstmeile.vercel.app`).

## Pre-test setup

1. The production Supabase has Migration A + B applied (run `pnpm supabase db push` from feat/role-management).
2. The invite-user Edge Function is deployed (`pnpm supabase functions deploy invite-user`).
3. Three test email addresses available (real or mailcatcher) to receive invitation emails.

## Owner workflow

- [ ] Log in as the existing global admin (or event owner).
- [ ] Open `/admin/events/<slug>/users`. The new "Users" nav link is visible at the top.
- [ ] Page shows the current owner in the list with role "Owner" and "Du selbst" label.
- [ ] Invite Form: enter `editor-test@example.com`, role "Editor", submit. Success toast.
- [ ] Check the test inbox — magic-link invitation email arrives.
- [ ] In a different browser / incognito, click the magic link. Set a password. Redirected to /admin.
- [ ] Back in the owner's session, refresh `/admin/events/<slug>/users`. New user appears in the list with role "Editor".
- [ ] Repeat for `contributor-test@example.com` with role "Contributor".

## Contributor workflow

- [ ] Log in as `contributor-test@example.com`.
- [ ] `/admin` dashboard loads.
- [ ] `/admin/events` shows ONLY the one event the contributor is a member of.
- [ ] `/admin/events/<slug>/tents` loads. "↓ Excel-Export" button visible. "CSV-Import" + "+ Neuer Stand" NOT visible.
- [ ] Click an existing tent → /admin/events/<slug>/tents/<id> loads. All form fields editable. Save works.
- [ ] Open public viewer `/<event-slug>` while logged in as contributor. Tent SidePanel shows "📷 Foto aufnehmen" + "+ Foto hinzufügen" buttons. Upload a photo — success.
- [ ] Navigate to `/admin/events/<slug>/categories` directly — redirected to `/admin/events/<slug>/tents`.
- [ ] Navigate to `/admin/events/<slug>/settings` directly — redirected.
- [ ] Navigate to `/admin/events/<slug>/users` directly — redirected.
- [ ] Navigate to `/admin/events/<slug>/tents/new` directly — redirected.
- [ ] Navigate to `/admin/events/<slug>/tents/import` directly — redirected.

## Editor workflow (sanity)

- [ ] Log in as `editor-test@example.com`.
- [ ] TentListPage shows "+ Neuer Stand" and "CSV-Import" buttons.
- [ ] CategoryListPage loads — can create / edit / delete categories.
- [ ] EventSettings — redirected (editor is NOT owner).
- [ ] Users page — redirected.
- [ ] Cannot invite another user from anywhere.

## Self-protection

- [ ] As owner, on Users page, the role dropdown for the owner's own row is replaced with just the text "Owner" (no select).
- [ ] No Remove button next to the owner's own row.
- [ ] As global admin viewing their own row in any event, the dropdown IS active and Remove IS visible (no self-protection — they have other escape hatches).

## Pending invites + resend

- [ ] Invite a new email `pending-test@example.com`. Do NOT click the link yet.
- [ ] Refresh the Users page. The new user shows with "(Pending)" prefix on the email and "Erneut senden" button instead of "Entfernen".
- [ ] Click "Erneut senden" — success toast. A new invitation email arrives in the inbox (or the same magic link).
- [ ] Click the link, set password, complete. The Users page now shows the user without (Pending).

## Role changes

- [ ] Owner changes `editor-test@example.com` from Editor to Contributor via dropdown. UI updates immediately.
- [ ] Switch to the Editor's session. Reload `/admin/events/<slug>/tents`. "+ Neuer Stand" + "CSV-Import" are now HIDDEN (they're a contributor now).
- [ ] Switch back. Owner changes back to Editor. The user's UI re-enables on next reload.

## Multi-event contributor

- [ ] Create a second event in the admin (as global admin).
- [ ] Invite `contributor-test@example.com` to the second event as well, role Contributor.
- [ ] Log in as contributor. EventListPage shows BOTH events.
- [ ] Editing tents in either event works.

## Edge cases

- [ ] Inviting an email that already has an account (no event membership): the user is added directly to `event_admins`, no new email sent. Toast says "added_to_existing_user".
- [ ] Inviting an email that's already a member of this event: error toast with the existing role.
- [ ] Edge Function returns 500 on network error: error toast with the message.

## Cross-feature: with Excel-Export

(After feat/excel-export PR #29 merges and feat/role-management rebases.)

- [ ] Contributor can use Excel-Export (read-only operation).
- [ ] Contributor cannot use Excel-Import (gated on `canEdit`).
```

- [ ] **Step 8.2: Final verification**

```bash
pnpm test:run
pnpm type-check
pnpm lint
pnpm build
```

Expected: all clean. Build produces dist/. Test count ~200-210.

- [ ] **Step 8.3: Commit smoke checklist**

```bash
git add tests/manual/role-management-smoke.md
git commit -m "docs(manual): smoke checklist for role management"
```

- [ ] **Step 8.4: Push the branch**

```bash
git push -u origin feat/role-management
```

Vercel rebuilds preview in ~1-2 minutes.

- [ ] **Step 8.5: Open the PR**

```bash
gh pr create --base main --head feat/role-management --title "feat: role management with contributor tier + magic-link invitations" --body "$(cat <<'EOF'
## Summary
- New event role 'contributor' below editor: can upload photos and correct stand info, cannot create/delete stands or events.
- Per-event user-management page at /admin/events/<slug>/users with magic-link invitations.
- New Supabase Edge Function 'invite-user' bridges the frontend to auth.admin.inviteUserByEmail.
- RLS policies refined to gate per-action; UI gates added across ~10 existing admin files.

## Background
Second of two follow-up features after the map pivot landed. See [docs/superpowers/specs/2026-05-27-role-management-design.md](docs/superpowers/specs/2026-05-27-role-management-design.md). Parallel to feat/excel-export PR #29 — both will be merged together.

## What is in this branch
- T1 \`feat(db)\`: ALTER TYPE event_role ADD VALUE 'contributor'.
- T2 \`feat(db)\`: refined has_event_role, split tents policy by action, lowered tent_photos/tent_categories/storage policies to contributor, extended handle_new_user trigger to read invite metadata, added get_event_permissions + get_event_users RPCs.
- T3 \`feat(functions)\`: invite-user Edge Function with README.
- T4 \`feat(hooks)\`: useEventPermissions returns 4 booleans.
- T5 \`feat(viewer)\`: RequireEventRole route guard component.
- T6 \`feat(admin)\`: UsersPage + UserRow + InviteUserForm + useEventUsers + i18n keys.
- T7 \`feat(admin)\`: UI gates and route guard wiring across ~10 existing files.
- T8 \`docs(manual)\`: smoke checklist.

## Verification
- \`pnpm test:run\`: full suite green (~200-210 tests).
- \`pnpm type-check\`: clean.
- \`pnpm lint\`: 12-error baseline preserved.
- \`pnpm build\`: succeeds.

## Pre-merge required user actions
- [ ] Apply Migrations A + B to production Supabase: \`pnpm supabase db push\`.
- [ ] Deploy the Edge Function: \`pnpm supabase functions deploy invite-user\`.
- [ ] Run [tests/manual/role-management-smoke.md](tests/manual/role-management-smoke.md) with three real test accounts.

## Coordination with PR #29
This PR is parallel to feat/excel-export PR #29. The two PRs touch overlapping locale JSON files and TentListPage.tsx button-block. Whichever merges second will need a small rebase. No code-logic conflicts expected.

Generated with Claude Code (https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8.6: User runs smoke + applies production migrations**

Pause. Wait for the user to:
1. Run `pnpm supabase db push` to apply Migrations A + B to production.
2. Run `pnpm supabase functions deploy invite-user`.
3. Run the smoke checklist with three test accounts.

If anything fails, fix as a small follow-up commit on the same branch — Vercel rebuilds preview, smoke re-runs.

- [ ] **Step 8.7: Coordinate the two-PR merge**

After both PR #29 (Excel-Export) and the role-management PR pass smoke:

1. **Merge order:** decide with the user. Excel-Export is simpler/lower-risk → consider merging it first.
2. **First merge:** `gh pr merge <pr-number> --squash --delete-branch`. Vercel deploys to production.
3. **Second PR rebase:**
   ```bash
   git checkout feat/<second-branch>
   git fetch origin
   git rebase origin/main
   # Resolve conflicts in TentListPage.tsx (button block) and locale JSONs.
   pnpm test:run && pnpm type-check && pnpm lint
   git push --force-with-lease
   ```
4. **Re-smoke** the second PR's preview after rebase. Then merge.

---

## Self-Review

**Spec coverage:**

- RM-001 (third role tier `'contributor'`): T1 (enum) + T2 (helper rewrite).
- RM-002 (contributor can: edit stands, upload photos, etc.): T2 (RLS policies refined per-action) + T7 (UI gates remove only the create/delete actions).
- RM-003 (contributor cannot: create/delete stands, events, categories): T2 + T7 (route guards + button hiding).
- RM-004 (magic-link via Edge Function): T3 (the function itself) + T6 (InviteUserForm calls it).
- RM-005 (UI at `/admin/events/<slug>/users`, owner+admin only): T7 (route in routes.tsx with `RequireEventRole minRole="owner"`).
- RM-006 (Supabase default email service): no code change — Edge Function uses default behavior; README confirms.
- RM-007 (any contributor-rights user can delete any photo): T2 (tent_photos policy refactored to contributor min_role).
- RM-008 (owner self-protection in UI, global admin not protected): T6 (UserRow's `isSelf` prop) + T6's UsersPage logic to pass it.
- RM-009 (pending state visible): T6 (UserRow renders "(Pending)" when `email_confirmed_at` is null).
- RM-010 (EventListPage RLS-filtered): verified in T8 smoke; no code change needed.
- RM-011 (RLS = security boundary, UI = UX): T2 covers RLS; T7's `RequireEventRole` is documented as UX only.
- RM-012 (migration split): T1 + T2 are split per the Postgres ENUM constraint.

**Placeholder scan:** No "TBD" / "fill in" / "similar to" patterns. The note about `feat/excel-export` rebase coordination is concrete with a step-by-step procedure.

**Type consistency:**

- `EventPermissions` interface fields: `loading`, `canAccess`, `canContribute`, `canEdit`, `canOwn` — used identically across T4 (hook), T5 (RequireEventRole), T7 (route guards + page gates).
- `EventUser` interface fields: `profileId`, `email`, `fullName`, `roleInEvent`, `emailConfirmedAt`, `invitedAt` — used identically across T6 (hook + UserRow + UsersPage).
- Role string literals: `'contributor' | 'editor' | 'owner'` everywhere. No 'helper' or 'volunteer' or any other variant.
- `RequireEventRole` `minRole` prop type matches the role literals.
- Edge Function `InviteBody.role_in_event: Role` matches `InviteUserForm`'s role state type.

No drift; implementation can proceed.
