"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useMyOrganizations, useAcceptOrganizationInvite } from "@/hooks/use-organizations";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SearchCommand } from "@/components/workspace/search-command";
import { CreateOrganizationOnboarding } from "@/components/workspace/create-organization-onboarding";
import { PENDING_ORG_INVITE_TOKEN_KEY } from "@/app/(auth)/accept-invite/page";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useSession();
  const myOrganizations = useMyOrganizations();
  const acceptInvite = useAcceptOrganizationInvite();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isConsumingPendingInvite, setIsConsumingPendingInvite] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/sign-in");
  }, [isLoading, isAuthenticated, router]);

  // A brand-new signup that arrived via an Organization invite link stashed
  // its token on /accept-invite (no session existed yet at that point) —
  // consume it here, the first time this User has an authenticated session
  // at all, so "auto-joined to the org after verification" doesn't need to
  // be threaded through Supabase's own email-confirmation redirect chain.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const pendingToken = sessionStorage.getItem(PENDING_ORG_INVITE_TOKEN_KEY);

    // Always resolve through a promise chain, even the "nothing to consume"
    // path — a setState call must happen inside a .then/.catch/.finally
    // callback, never synchronously in the effect's own body
    // (react-hooks/set-state-in-effect).
    const consume = pendingToken
      ? acceptInvite(pendingToken)
          // Invalid/expired/already-used token — fall through to onboarding
          // rather than blocking the workspace on a stale stashed value.
          .catch(() => {})
          .finally(() => sessionStorage.removeItem(PENDING_ORG_INVITE_TOKEN_KEY))
      : Promise.resolve();

    consume.finally(() => {
      if (active) setIsConsumingPendingInvite(false);
    });

    return () => {
      active = false;
    };
  }, [user, acceptInvite]);

  if (isLoading || !isAuthenticated || isConsumingPendingInvite) return null;

  if (myOrganizations.length === 0) {
    return <CreateOrganizationOnboarding />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <WorkspaceSidebar onOpenSearch={() => setIsSearchOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      <SearchCommand open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </div>
  );
}
