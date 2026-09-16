"use client";

import { useParams } from "next/navigation";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicCurrentSpace } from "@/hooks/use-public-content";
import { PublicSpaceProvider } from "@/hooks/public-space-context";
import { PublicNav } from "@/components/public/public-nav";
import { PublicToc } from "@/components/public/public-toc";

export function PublicLayoutClient({ children }: { children: React.ReactNode }) {
  const { organization } = usePublicOrgContext();
  const currentSpace = usePublicCurrentSpace(organization?.id);
  const params = useParams<{ spaceSlug?: string; pageSlug?: string }>();
  // Synchronous: whether this route is *inside* a Space at all (so the rail
  // shows immediately, before currentSpace finishes resolving) vs. the Space
  // directory (org home), which is full-width.
  const isInsideSpace = Boolean(params?.spaceSlug || params?.pageSlug);

  if (!organization) return null;

  return (
    <PublicSpaceProvider value={currentSpace}>
      <div className="flex min-h-screen flex-col bg-background">
        <PublicNav organization={organization} />
        <div className="mx-auto flex w-full max-w-[90rem] flex-1">
          {isInsideSpace && (
            <aside className="hidden w-toc-rail shrink-0 border-r border-border lg:block">
              <PublicToc />
            </aside>
          )}
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </PublicSpaceProvider>
  );
}
