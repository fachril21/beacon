import { SetPasswordForm } from "@/components/auth/set-password-form";

/**
 * Second hop of the invite email's journey: the email link lands on
 * /accept-invite (which consumes the invitation token), and a successful
 * accept routes here. By the time this renders, Supabase's browser client
 * has already established a session — the invited Account already exists
 * (inviteUserByEmail created it, passwordless) and, per handle_new_user,
 * already has the Organization membership. This screen's only job is
 * letting them set a password so they can actually sign back in later.
 */
export default function CompleteInvitePage() {
  return <SetPasswordForm mode="invite" />;
}
