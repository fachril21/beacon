"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SearchCommand } from "@/components/workspace/search-command";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);

  useEffect(() => {
    // Let the mock session hydrate from localStorage on first mount before deciding to redirect.
    const id = setTimeout(() => setHasCheckedSession(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (hasCheckedSession && !isAuthenticated) router.replace("/sign-in");
  }, [hasCheckedSession, isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <WorkspaceSidebar onOpenSearch={() => setIsSearchOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      <SearchCommand open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </div>
  );
}
