import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Server-only half of Space invites (PRD.md Flow 7 step 4). The DB-level
 * grant/pending decision (invite_to_space RPC,
 * 20260814000000_invite_to_space_rpc.sql) already works from the browser —
 * this route exists only for the "no Account yet" branch, which needs an
 * actual notification sent to the invited email. Supabase Auth has no
 * generic mailer callable from the browser; sending a real email requires
 * `auth.admin.inviteUserByEmail`, which needs the service-role key and must
 * never run client-side.
 */
export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
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

  // Runs under the caller's own session (cookies), so invite_to_space's own
  // admin guard (space_role_at_least) is what actually authorizes this —
  // this route doesn't duplicate that check.
  const { data, error } = await supabase.rpc("invite_to_space", { p_space_id: spaceId, p_email: email, p_role: role });
  if (error) {
    if (error.message.includes("NOT_AUTHORIZED")) {
      return NextResponse.json({ error: "NOT_AUTHORIZED" }, { status: 403 });
    }
    if (error.message.includes("EMAIL_BELONGS_TO_ANOTHER_ORGANIZATION")) {
      return NextResponse.json({ error: "EMAIL_BELONGS_TO_ANOTHER_ORGANIZATION" }, { status: 409 });
    }
    return NextResponse.json({ error: "INVITE_FAILED" }, { status: 500 });
  }

  const result = data as
    | { status: "added"; permission: Record<string, unknown> }
    | { status: "invited"; invite: Record<string, unknown> };

  if (result.status === "added") {
    return NextResponse.json(result);
  }

  const admin = getSupabaseAdminClient();
  const siteUrl = new URL(request.url).origin;
  const redirectTo = `${siteUrl}/complete-invite`;
  const { error: emailError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  // inviteUserByEmail fails outright when an auth.users row for this email
  // already exists (e.g. a prior invite attempt that was never completed by
  // the invited person) — but with no `profiles` row, that person still has
  // no Beacon Account. A hard failure here would silently drop them on a
  // re-invite, so fall back to a recovery-style email through the same
  // underlying account: GoTrue has no "resend invite" endpoint, but
  // resetPasswordForEmail sends real mail to any existing auth account and
  // lands them back on the same "create your account" screen.
  let emailSent = !emailError;
  if (emailError && isAlreadyRegisteredAuthError(emailError)) {
    const { error: resendError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    emailSent = !resendError;
  }

  // inviteUserByEmail creates the auth.users row immediately (before the
  // invited person does anything), which fires handle_new_user and may
  // already have resolved the pending_invites row this RPC call just
  // created into a real Permission — so re-check the ground truth instead
  // of trusting the pre-email "invited" snapshot.
  const { data: profile } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (profile) {
    const { data: permission } = await admin
      .from("permissions")
      .select("*")
      .eq("space_id", spaceId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (permission) {
      return NextResponse.json({ status: "added", permission, emailSent });
    }
  }

  // The DB-side pending_invites row already exists regardless of whether
  // the email itself sent — report emailSent so the UI can tell the admin
  // to notify the person manually instead of reporting a hard failure for
  // something that actually worked at the data layer.
  return NextResponse.json({ status: "invited", invite: result.invite, emailSent });
}

/** Mirrors the same "already registered" phrase-matching used by signUp's error handling (use-session.tsx). */
function isAlreadyRegisteredAuthError(error: { message: string }): boolean {
  const message = error.message.toLowerCase();
  return (message.includes("already") && message.includes("registered")) || message.includes("already exists");
}
