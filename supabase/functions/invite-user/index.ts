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
