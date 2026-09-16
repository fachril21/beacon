"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usePublicSpace } from "@/hooks/public-space-context";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { flattenPageTree } from "@/lib/build-page-tree";
import { cn } from "@/lib/utils";

/**
 * Sidebar for the public site — scoped to the ONE Space the visitor is in
 * (resolved by the layout shell into PublicSpaceContext), never a merged list
 * across Spaces. Renders nothing on the Space directory (org home).
 */
export function PublicToc() {
  const current = usePublicSpace();
  const { basePath } = usePublicOrgContext();
  const pathname = usePathname();

  if (!current) return null;

  const { space, pages } = current;
  const rows = flattenPageTree(pages).filter(({ page }) => page.slug);

  return (
    <nav className="flex flex-col gap-4 px-4 py-6">
      <Link
        href={basePath}
        className="flex items-center gap-1.5 px-2 text-caption font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Semua dokumentasi
      </Link>

      <div className="flex flex-col gap-1">
        <p className="px-2 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">{space.name}</p>
        {rows.length === 0 ? (
          <p className="px-2 py-1.5 text-body-sm text-muted-foreground">Belum ada halaman yang dipublikasikan.</p>
        ) : (
          rows.map(({ page, depth }) => {
            const href = `${basePath}/pages/${page.slug}`;
            const isActive = pathname === href;
            return (
              <Link
                key={page.id}
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
            );
          })
        )}
      </div>
    </nav>
  );
}
