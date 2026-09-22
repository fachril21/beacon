"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "@/hooks/use-session";

/**
 * complete-invite is the one (auth) page that needs an active session to
 * work at all — Supabase's client establishes one from the invite email
 * link's URL token before the page can render its set-password form
 * (SetPasswordForm). Redirecting it away the instant it's "authenticated"
 * would bounce every real invited User to Workspace Home before they could
 * ever set a password. Password recovery has no Beacon-side equivalent: it's
 * consolidated on Kerjain (src/lib/supabase/env.ts's getKerjainForgotPasswordUrl).
 */
const SKIP_AUTHENTICATED_REDIRECT = new Set(["/complete-invite"]);

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
