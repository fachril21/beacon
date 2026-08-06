"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePublicToc } from "@/hooks/use-public-content";
import { cn } from "@/lib/utils";

export function PublicToc({ organizationId }: { organizationId: string }) {
  const toc = usePublicToc(organizationId);
  const pathname = usePathname();

  if (toc.length === 0) {
    return <p className="px-4 py-6 text-body-sm text-muted-foreground">Belum ada halaman yang dipublikasikan.</p>;
  }

  return (
    <nav className="flex flex-col gap-5 px-4 py-6">
      {toc.map(({ space, pages }) => (
        <div key={space.id} className="flex flex-col gap-1">
          <p className="px-2 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">{space.name}</p>
          {pages.map((page) => {
            const href = `/public/pages/${page.id}`;
            const isActive = pathname === href;
            return (
              <Link
                key={page.id}
                href={href}
                className={cn(
                  "rounded-sm px-2 py-1.5 text-body-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                  isActive && "bg-accent text-foreground font-medium",
                )}
              >
                {page.title || "Halaman tanpa judul"}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
