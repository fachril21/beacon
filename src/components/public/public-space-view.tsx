"use client";

import { BookOpen } from "lucide-react";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicSpace, usePublicSpaceStatus } from "@/hooks/public-space-context";
import { EmptyState } from "@/components/beacon/empty-state";
import { SpaceLayoutView } from "@/components/space/space-layout-view";
import { flattenPageTree } from "@/lib/build-page-tree";
import { PageNotAvailable } from "./page-not-available";
import { PublicSpaceSkeleton } from "./public-loading";

/**
 * Public landing for a single Space. It renders the admin-authored layout
 * (sections/columns/page order) from `spaces.layout`, using only Pages the
 * public query returned — which RLS has already narrowed to published,
 * publishable Pages in a publishable Space. A saved layout that has drifted
 * from the current Page set is merged, so new published Pages are never lost
 * and deleted/unpublished Pages never leak.
 */
export function PublicSpaceView() {
  const { organization, basePath } = usePublicOrgContext();
  const current = usePublicSpace();
  const status = usePublicSpaceStatus();

  if (!organization) return null;
  if (status === "loading") return <PublicSpaceSkeleton />;
  if (!current) return <PageNotAvailable organizationName={organization.name} />;

  const { space, pages } = current;
  const publishedPages = flattenPageTree(pages)
    .filter(({ page }) => page.slug)
    .map(({ page }) => page);

  return (
    <main className="flex-1 px-6 py-10 lg:px-10 lg:py-14">
      <div className="mx-auto w-full max-w-[64rem]">
        <SpaceLayoutView space={space} pages={publishedPages} basePath={basePath} mode="public" />
        {publishedPages.length === 0 && (
          <EmptyState icon={BookOpen} title="Belum ada panduan yang dipublikasikan" className="mt-10" />
        )}
      </div>
    </main>
  );
}
