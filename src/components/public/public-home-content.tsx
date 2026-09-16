"use client";

import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicSpaces } from "@/hooks/use-public-content";
import { EmptyState } from "@/components/beacon/empty-state";

/**
 * Public site home — a directory of the Organization's publishable Spaces.
 * Each Space links to its own page (/public/{orgSlug}/spaces/{slug}); the
 * home never merges pages from different Spaces into one list.
 */
export function PublicHomeContent() {
  const { organization, basePath } = usePublicOrgContext();
  const spaces = usePublicSpaces(organization?.id);

  if (!organization) return null;

  return (
    <main className="flex-1 px-8 py-12">
      <div className="mx-auto max-w-reading-column">
        <h1 className="text-display font-bold tracking-tight text-foreground">Dokumentasi {organization.name}</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          Panduan penggunaan produk {organization.name}, ditulis oleh tim internal.
        </p>

        {spaces.length === 0 ? (
          <EmptyState icon={BookOpen} title="Belum ada panduan yang dipublikasikan" className="mt-16" />
        ) : (
          <div className="mt-10 flex flex-col gap-3">
            {spaces.map(({ space, publishedPageCount }) => (
              <Link
                key={space.id}
                href={`${basePath}/spaces/${space.slug}`}
                className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 hover:border-foreground/20 hover:bg-accent"
              >
                <div>
                  {space.category && (
                    <p className="mb-0.5 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                      {space.category}
                    </p>
                  )}
                  <p className="text-h4 font-semibold text-foreground">{space.name}</p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {publishedPageCount} halaman
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
