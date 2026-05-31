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
