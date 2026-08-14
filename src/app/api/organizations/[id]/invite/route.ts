import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Server-only half of Organization invites — mirrors
 * /api/spaces/[spaceId]/invite/route.ts exactly (same DB-level
 * grant/pending decision already works from the browser via
 * invite_to_organization; this route exists only for the "no Account yet"
 * branch, which needs a real notification email via
 * `auth.admin.inviteUserByEmail`, service-role-only). Unlike the Space
 * route, there's no "already resolved by the time the email finished
 * sending" race to re-check here: joining an Organization is never
 * automatic on signup (handle_new_user doesn't touch org membership at
 * all), it only ever happens via an explicit accept_organization_invite
 * call — so the RPC's pre-email "invited" snapshot is always still accurate.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { email, role } = (await request.json()) as { email?: string; role?: string };
  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Runs under the caller's own session (cookies), so invite_to_organization's
  // own admin guard (is_organization_owner_or_admin) is what actually
  // authorizes this — this route doesn't duplicate that check.
  const { data, error } = await supabase.rpc("invite_to_organization", {
    p_organization_id: id,
    p_email: email,
    p_role: role,
  });
  if (error) {
    if (error.message.includes("NOT_AUTHORIZED")) {
      return NextResponse.json({ error: "NOT_AUTHORIZED" }, { status: 403 });
    }
    if (error.message.includes("INVALID_ROLE")) {
      return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
    }
    return NextResponse.json({ error: "INVITE_FAILED" }, { status: 500 });
  }

  const result = data as
    | { status: "added"; membership: Record<string, unknown> }
    | { status: "invited"; invite: { id: string; token: string } & Record<string, unknown> };

  if (result.status === "added") {
    return NextResponse.json(result);
  }

  const admin = getSupabaseAdminClient();
  const siteUrl = new URL(request.url).origin;
  const redirectTo = `${siteUrl}/accept-invite?token=${result.invite.token}`;
  const { error: emailError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  // Mirrors the Space-invite route's fallback: inviteUserByEmail fails
  // outright when an auth.users row for this email already exists (e.g. a
  // prior invite attempt never completed) — resend via
  // resetPasswordForEmail through the same underlying account instead of
  // silently dropping the notification.
  let emailSent = !emailError;
  if (emailError && isAlreadyRegisteredAuthError(emailError)) {
    const { error: resendError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    emailSent = !resendError;
  }

  return NextResponse.json({ status: "invited", invite: result.invite, emailSent });
}

/** Mirrors the same "already registered" phrase-matching used elsewhere (use-session.tsx, the Space-invite route). */
function isAlreadyRegisteredAuthError(error: { message: string }): boolean {
  const message = error.message.toLowerCase();
  return (message.includes("already") && message.includes("registered")) || message.includes("already exists");
}
