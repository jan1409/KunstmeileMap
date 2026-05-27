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
locally, open the browser devtools console, and run:

```js
(await supabase.auth.getSession()).data.session?.access_token
```

(supabase-js v2 stores the session under `sb-<project-ref>-auth-token` in
`localStorage`, where the value is JSON containing `.access_token` — but
`getSession()` is the version-stable path that doesn't depend on the key shape.)

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
| 200 | `{ ok, user_id, status: 'resent' }` | Re-sent magic link for an existing pending user (auth row exists but `email_confirmed_at` is null). |
| 400 | `{ error: 'missing_fields' / 'invalid_role' / 'invalid_json' }` | Bad request body. |
| 400 | `{ error: 'already_member', existing_role }` | This email already has a confirmed role in this event. |
| 401 | `{ error: 'unauthenticated' }` | Missing or invalid JWT. |
| 403 | `{ error: 'not_event_owner' }` | Caller is not Owner / global admin. |
| 500 | `{ error: 'invite_failed' / 'list_users_failed' / 'resend_failed' / ... }` | Server-side Supabase API error. |
