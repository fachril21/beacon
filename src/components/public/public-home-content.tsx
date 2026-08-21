"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicToc } from "@/hooks/use-public-content";
import { EmptyState } from "@/components/beacon/empty-state";
import type { PageTreeNode } from "@/lib/build-page-tree";

/**
 * Read-only, always-expanded rendering of a Space's published page tree —
 * mirrors PublicToc's nesting so the home page and sidebar never disagree
 * about a Space's structure.
 */
function HomePageNode({ node, depth, basePath }: { node: PageTreeNode; depth: number; basePath: string }) {
  const { page, children } = node;
  if (!page.slug) return null;

  return (
    <>
      <Link
        href={`${basePath}/pages/${page.slug}`}
        data-depth={depth}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        className="rounded-md py-2 pr-3 text-body text-foreground hover:bg-accent"
      >
        {page.title || "Halaman tanpa judul"}
      </Link>
      {children.map((child) => (
        <HomePageNode key={child.page.id} node={child} depth={depth + 1} basePath={basePath} />
      ))}
    </>
  );
}

/**
 * Shared body for both the custom-domain (/public) and platform-domain
 * (/public/[orgSlug]) home routes — usePublicOrgContext resolves the right
 * Organization for either one and supplies basePath so the two trees'
 * page links stay correctly shaped without this component knowing which
 * tree it's rendering in.
 */
export function PublicHomeContent() {
  const { organization, basePath } = usePublicOrgContext();
  const toc = usePublicToc(organization?.id);

  if (!organization) return null;

  return (
    <main className="flex-1 px-8 py-12">
      <div className="mx-auto max-w-reading-column">
        <h1 className="text-display font-bold tracking-tight text-foreground">Dokumentasi {organization.name}</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          Panduan penggunaan produk {organization.name}, ditulis oleh tim internal.
        </p>

        {toc.length === 0 ? (
          <EmptyState icon={BookOpen} title="Belum ada panduan yang dipublikasikan" className="mt-16" />
        ) : (
          <div className="mt-10 flex flex-col gap-8">
            {toc.map(({ space, pages }) => (
              <div key={space.id}>
                <h2 className="text-h3 font-semibold text-foreground">{space.name}</h2>
                <div className="mt-3 flex flex-col gap-1">
                  {pages.map((node) => (
                    <HomePageNode key={node.page.id} node={node} depth={0} basePath={basePath} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
