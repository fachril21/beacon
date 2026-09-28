"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicSpaces } from "@/hooks/use-public-content";
import { EmptyState } from "@/components/beacon/empty-state";
import { PublicSearchCommand } from "./public-search-command";

/**
 * Public site home — a centered hero (search + "Terbaru:" recently
 * published pages) plus a directory of the Organization's publishable
 * Spaces as a topic grid. Each Space links to its own page
 * (/public/{orgSlug}/spaces/{slug}); the home never merges pages from
 * different Spaces into one list beyond the small recency chip row.
 */
export function PublicHomeContent() {
  const { organization, basePath } = usePublicOrgContext();
  const { spaces, recentPages } = usePublicSpaces(organization?.id);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  if (!organization) return null;

  return (
    <main className="flex-1 px-6 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-(--width-reading-column) text-center">
        <h1 className="text-display font-bold tracking-tight text-foreground">Dokumentasi {organization.name}</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          Panduan penggunaan produk {organization.name}, ditulis oleh tim internal.
        </p>

        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="mx-auto mt-8 flex w-full max-w-[40rem] items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 text-left text-body text-muted-foreground hover:bg-accent"
        >
          <Search className="size-4.5 shrink-0" />
          Cari dokumentasi…
        </button>

        {recentPages.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-body-sm">
            <span className="text-muted-foreground">Terbaru:</span>
            {recentPages.map((page) => (
              <Link
                key={page.slug}
                href={`${basePath}/pages/${page.slug}`}
                className="rounded-full border border-border px-3 py-1 text-foreground hover:bg-accent"
              >
                {page.title || "Halaman tanpa judul"}
              </Link>
            ))}
          </div>
        )}
      </div>

      {spaces.length === 0 ? (
        <EmptyState icon={BookOpen} title="Belum ada panduan yang dipublikasikan" className="mt-16" />
      ) : (
        <div className="mx-auto mt-16 max-w-(--width-app-shell)">
          <h2 className="text-h3 font-semibold text-foreground">Jelajahi berdasarkan topik</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map(({ space, publishedPageCount }) => (
              <Link
                key={space.id}
                href={`${basePath}/spaces/${space.slug}`}
                className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-5 hover:border-foreground/20 hover:bg-accent"
              >
                {space.category && (
                  <p className="text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">{space.category}</p>
                )}
                <p className="text-h4 font-semibold text-foreground">{space.name}</p>
                <p className="mt-0.5 text-caption text-muted-foreground">{publishedPageCount} halaman</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <PublicSearchCommand organizationId={organization.id} open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </main>
  );
}
