# REST API

KunstmeileMap exposes a REST API to manage **events**, their **tents**, and tent
**photos** from other programs. It is implemented as Supabase Edge Functions and
authorization is enforced by the database, so every call respects the same role
rules as the admin UI.

- **Interactive reference (Swagger UI):** in the app under **Admin → API**
  (`/admin/api-docs`).
- **Machine-readable spec:** `‹your app URL›/openapi.json` (OpenAPI 3.1).

## Base URL

```
https://<project-ref>.supabase.co/functions/v1
```

`<project-ref>` is your Supabase project reference id.

## Authentication

Every request must send **two** headers:

| Header | Value |
|---|---|
| `apikey` | your Supabase **anon key** |
| `Authorization` | `Bearer <access token>` of a signed-in user |

Create a dedicated **machine account** (a normal Supabase user) per integration
and give it a role:

- a **global admin** (`profiles.role = 'admin'`) can do everything across all events;
- or grant it a per-event role (`owner` / `editor` / `contributor`) under
  **Admin → Users**.

Obtain a token with the email/password of that account:

```bash
curl -s -X POST \
  "https://<project-ref>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"integration@example.com","password":"…"}'
# → { "access_token": "<JWT>", "refresh_token": "…", ... }
```

On **Windows PowerShell**, `curl` is an alias for `Invoke-WebRequest` (which
rejects the `-H` syntax above). Use `curl.exe` for the curl commands, or the
native form:

```powershell
$anon = "<ANON_KEY>"
$body = @{ email = "integration@example.com"; password = "…" } | ConvertTo-Json
$resp = Invoke-RestMethod -Method Post `
  -Uri "https://<project-ref>.supabase.co/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $anon } -ContentType "application/json" -Body $body
$token = $resp.access_token

# then call the API:
Invoke-RestMethod -Uri "https://<project-ref>.supabase.co/functions/v1/events" `
  -Headers @{ apikey = $anon; Authorization = "Bearer $token" }
```

The token expires after ~1 hour; use the `refresh_token` to get a new one.

## Permissions

| Action | admin | owner | editor | contributor |
|---|:--:|:--:|:--:|:--:|
| Events – read | all | own | own | own |
| Events – create / delete | ✅ | – | – | – |
| Events – update | ✅ | ✅ | – | – |
| Tents – create / delete | ✅ | ✅ | ✅ | – |
| Tents – update | ✅ | ✅ | ✅ | ✅ |
| Photos – upload / update / delete | ✅ | ✅ | ✅ | ✅ |

Published events are readable by any authenticated account. Denied writes return
`403`.

## Endpoints

| Method & path | Purpose |
|---|---|
| `GET /events` · `GET /events/{id}` | List / read events |
| `POST /events` | Create an event (admin) |
| `PATCH /events/{id}` · `DELETE /events/{id}` | Update (owner/admin) / delete (admin) |
| `GET /tents?event_id={id}` · `GET /tents/{id}` | List / read tents |
| `POST /tents` | Create a tent (editor+) |
| `PATCH /tents/{id}` · `DELETE /tents/{id}` | Update / delete a tent |
| `GET /photos?tent_id={id}` · `GET /photos/{id}` | List / read photos |
| `GET /photos/{id}?download=1` | Redirect to the original file |
| `POST /photos` | Upload a photo (`multipart/form-data`) |
| `PATCH /photos/{id}` · `DELETE /photos/{id}` | Update caption/order / delete |

## Examples

These use bash + curl. On Windows PowerShell, run them with `curl.exe`, or adapt
to `Invoke-RestMethod` as shown in the Authentication section above.

Set up shell variables:

```bash
BASE="https://<project-ref>.supabase.co/functions/v1"
ANON="<ANON_KEY>"
TOKEN="<access token from the auth step>"
AUTH=(-H "apikey: $ANON" -H "Authorization: Bearer $TOKEN")
```

Create an event (admin):

```bash
curl -X POST "$BASE/events" "${AUTH[@]}" -H "Content-Type: application/json" \
  -d '{"slug":"kunstmeile-2027","title_de":"Kunstmeile 2027","year":2027}'
```

Add a tent:

```bash
curl -X POST "$BASE/tents" "${AUTH[@]}" -H "Content-Type: application/json" \
  -d '{"event_id":"<EVENT_ID>","slug":"galerie-nord","name":"Galerie Nord"}'
```

Upload a photo:

```bash
curl -X POST "$BASE/photos" "${AUTH[@]}" \
  -F "tent_id=<TENT_ID>" -F "file=@./photo.jpg" -F "caption_de=Stand"
```

List a tent's photos (each item includes `url`, `thumb_url`, `full_url`):

```bash
curl "$BASE/photos?tent_id=<TENT_ID>" "${AUTH[@]}"
```

Delete a tent:

```bash
curl -X DELETE "$BASE/tents/<TENT_ID>" "${AUTH[@]}"
```

## Errors

Errors are JSON: `{ "error": "<code>", "message": "<detail>" }` with HTTP status
`400` (validation), `401` (no/invalid token), `403` (not permitted), `404` (not
found), `409` (duplicate, e.g. slug), or `500`.
