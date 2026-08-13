"use client";

import { usePublicOrgContext } from "@/hooks/use-public-org";
import { PublicNav } from "@/components/public/public-nav";
import { PublicToc } from "@/components/public/public-toc";

export function PublicLayoutClient({ children }: { children: React.ReactNode }) {
  const { organization } = usePublicOrgContext();

  if (!organization) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav organization={organization} />
      <div className="mx-auto flex w-full max-w-[90rem] flex-1">
        <aside className="hidden w-toc-rail shrink-0 border-r border-border lg:block">
          <PublicToc organizationId={organization.id} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
