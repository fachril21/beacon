"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePublicToc } from "@/hooks/use-public-content";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import type { PageTreeNode } from "@/lib/build-page-tree";
import { cn } from "@/lib/utils";

/**
 * Read-only, always-expanded rendering of a Space's published page tree —
 * mirrors the editor sidebar's parent/child nesting (PageTreeItem) minus the
 * edit-only affordances (drag handle, add/delete menu, collapse toggle),
 * since the public TOC is meant to stay a simple, scannable table of
 * contents (PRD.md Flow 5), not a full page-management UI.
 */
function PublicTocNode({
  node,
  depth,
  basePath,
  pathname,
}: {
  node: PageTreeNode;
  depth: number;
  basePath: string;
  pathname: string | null;
}) {
  const { page, children } = node;
  if (!page.slug) return null;

  const href = `${basePath}/pages/${page.slug}`;
  const isActive = pathname === href;

  return (
    <>
      <Link
        href={href}
        data-depth={depth}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        className={cn(
          "rounded-sm py-1.5 pr-2 text-body-sm text-muted-foreground hover:bg-accent hover:text-foreground",
          isActive && "bg-accent text-foreground font-medium",
        )}
      >
        {page.title || "Halaman tanpa judul"}
      </Link>
      {children.map((child) => (
        <PublicTocNode key={child.page.id} node={child} depth={depth + 1} basePath={basePath} pathname={pathname} />
      ))}
    </>
  );
}

export function PublicToc({ organizationId }: { organizationId: string }) {
  const toc = usePublicToc(organizationId);
  const { basePath } = usePublicOrgContext();
  const pathname = usePathname();

  if (toc.length === 0) {
    return <p className="px-4 py-6 text-body-sm text-muted-foreground">Belum ada halaman yang dipublikasikan.</p>;
  }

  return (
    <nav className="flex flex-col gap-5 px-4 py-6">
      {toc.map(({ space, pages }) => (
        <div key={space.id} className="flex flex-col gap-1">
          <p className="px-2 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">{space.name}</p>
          {pages.map((node) => (
            <PublicTocNode key={node.page.id} node={node} depth={0} basePath={basePath} pathname={pathname} />
          ))}
        </div>
      ))}
    </nav>
  );
}
