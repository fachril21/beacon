import { SetPasswordForm } from "@/components/auth/set-password-form";

/**
 * Landing target for the Space-invite email (auth.admin.inviteUserByEmail's
 * redirectTo, src/app/api/spaces/[spaceId]/invite/route.ts). By the time
 * this renders, Supabase's browser client has already parsed the email
 * link's token from the URL and established a session — the invited
 * Account already exists and, per handle_new_user, may already have the
 * Space Permission granted. This screen's only job is letting them set a
 * password so they can actually sign back in later.
 */
export default function CompleteInvitePage() {
  return <SetPasswordForm mode="invite" />;
}
