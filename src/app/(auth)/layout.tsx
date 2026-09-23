"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "@/hooks/use-session";

/**
 * complete-invite and accept-invite are the two (auth) pages that need an
 * active session to work at all. complete-invite: Supabase's client
 * establishes one from the invite email link's URL token before the page
 * can render its set-password form (SetPasswordForm). accept-invite: an
 * Organization invite to someone who ALREADY has a Beacon Account (but
 * isn't a member of that Organization yet, so invite_to_organization's own
 * "already registered" fallback sends them a real recovery-style email
 * instead of an account-creation one — src/app/api/organizations/[id]/invite/route.ts)
 * also establishes a session from the URL token on arrival, then needs to
 * stay put long enough to call accept_organization_invite itself. Redirecting
 * either page away the instant it's "authenticated" would bounce the User to
 * Workspace Home before they could ever set a password or accept the invite.
 * Password recovery has no Beacon-side equivalent: it's consolidated on
 * Kerjain (src/lib/supabase/env.ts's getKerjainForgotPasswordUrl).
 */
const SKIP_AUTHENTICATED_REDIRECT = new Set(["/complete-invite", "/accept-invite"]);

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useSession();

  useEffect(() => {
    if (isAuthenticated && !SKIP_AUTHENTICATED_REDIRECT.has(pathname)) router.replace("/");
  }, [isAuthenticated, pathname, router]);

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
            <path
              d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <span className="text-h4 font-semibold text-foreground">Beacon</span>
      </div>
      {children}
    </div>
  );
}
