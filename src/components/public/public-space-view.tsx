"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicSpace } from "@/hooks/public-space-context";
import { EmptyState } from "@/components/beacon/empty-state";
import { PageNotAvailable } from "./page-not-available";
import { flattenPageTree } from "@/lib/build-page-tree";

/**
 * Public landing for a single Space — its name and its own published page
 * tree, nothing from any other Space. The current Space is resolved by the
 * layout shell (usePublicCurrentSpace) into PublicSpaceContext.
 */
export function PublicSpaceView() {
  const { organization, basePath } = usePublicOrgContext();
  const current = usePublicSpace();

  if (!organization) return null;
  if (!current) return <PageNotAvailable organizationName={organization.name} />;

  const { space, pages } = current;
  const rows = flattenPageTree(pages).filter(({ page }) => page.slug);

  return (
    <main className="flex-1 px-8 py-12">
      <div className="mx-auto max-w-reading-column">
        {space.category && (
          <p className="mb-1.5 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">
            {space.category}
          </p>
        )}
        <h1 className="text-display font-bold tracking-tight text-foreground">{space.name}</h1>

        {rows.length === 0 ? (
          <EmptyState icon={BookOpen} title="Belum ada panduan yang dipublikasikan" className="mt-16" />
        ) : (
          <div className="mt-10 flex flex-col gap-1">
            {rows.map(({ page, depth }) => (
              <Link
                key={page.id}
                href={`${basePath}/pages/${page.slug}`}
                data-depth={depth}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                className="rounded-md py-2 pr-3 text-body text-foreground hover:bg-accent"
              >
                {page.title || "Halaman tanpa judul"}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
