"use client";

import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { mergeLayoutWithPages } from "@/lib/space-layout";
import { titleOrUntitled } from "@/lib/page-label";
import { StatusBadge } from "@/components/beacon/status-badge";
import { getPageStatus } from "@/hooks/use-pages";
import type { Page, Space } from "@/lib/types";

interface SpaceLayoutViewProps {
  space: Space;
  /** Pages to render. Public callers pass only published Pages; the builder passes every Page. */
  pages: Page[];
  /** Public URL prefix (e.g. "/public/acme"). Omit in preview mode to render non-navigating cards. */
  basePath?: string;
  mode?: "public" | "preview";
  /** Builder-only: opens the Page editor from a preview card. */
  onOpenPage?: (page: Page) => void;
  className?: string;
}

const COL_SPAN_CLASS: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
};

/**
 * The one renderer shared by the public Space landing page and the Space
 * Builder's live preview. Keeping a single component means what an admin sees
 * in the preview is exactly what a visitor gets — same sections, column counts,
 * page order, and fallbacks for Pages added after the layout was saved.
 */
export function SpaceLayoutView({ space, pages, basePath, mode = "public", onOpenPage, className }: SpaceLayoutViewProps) {
  const layout = mergeLayoutWithPages(space.layout, pages);
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const isPreview = mode === "preview";

  return (
    <div className={cn("flex flex-col gap-10", className)}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-2xl leading-none">
          {space.icon ? <span aria-hidden>{space.icon}</span> : <FileText className="size-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          {space.category && (
            <p className="mb-1.5 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">{space.category}</p>
          )}
          <h1 className="text-h1 font-bold tracking-tight text-foreground">{space.name}</h1>
          {space.description && <p className="mt-2 max-w-2xl text-body text-muted-foreground">{space.description}</p>}
        </div>
      </header>

      <div className="flex flex-col gap-10">
        {layout.sections.map((section) => {
          const sectionPages = section.pages
            .map((item) => ({ item, page: pagesById.get(item.pageId) }))
            .filter((entry): entry is { item: (typeof section.pages)[number]; page: Page } => Boolean(entry.page));

          if (sectionPages.length === 0 && !isPreview) return null;

          return (
            <section key={section.id} aria-labelledby={`space-section-${section.id}`} className="flex flex-col gap-4">
              <div>
                <h2 id={`space-section-${section.id}`} className="text-h3 font-semibold text-foreground">
                  {section.title || "Tanpa judul"}
                </h2>
                {section.description && <p className="mt-1 text-body-sm text-muted-foreground">{section.description}</p>}
              </div>

              {sectionPages.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-body-sm text-muted-foreground">
                  Belum ada Halaman di bagian ini.
                </p>
              ) : (
                <div
                  className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(var(--section-columns),minmax(0,1fr))]"
                  style={{ "--section-columns": section.columns } as CSSProperties}
                >
                  {sectionPages.map(({ item, page }) => {
                    const href = basePath && page.slug ? `${basePath}/pages/${page.slug}` : null;
                    // A card may only span as many columns as this section has —
                    // narrowing a section must not leave a card overflowing its grid.
                    const span = Math.min(section.columns, Math.max(1, item.colSpan ?? 1));
                    const cardClassName = cn(
                      "group/card flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors",
                      href && "hover:border-primary/60 hover:bg-accent",
                      COL_SPAN_CLASS[span],
                    );

                    const body = (
                      <>
                        <div className="flex items-start gap-2.5">
                          {page.emoji ? (
                            <span className="shrink-0 text-lg leading-none" aria-hidden>
                              {page.emoji}
                            </span>
                          ) : (
                            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 text-h4 font-semibold text-foreground group-hover/card:text-primary-muted-foreground">
                            {titleOrUntitled(page.title)}
                          </span>
                          {!isPreview && href && (
                            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100" />
                          )}
                        </div>
                        {page.description && (
                          <p className="line-clamp-2 text-body-sm text-muted-foreground">{page.description}</p>
                        )}
                        {isPreview && <StatusBadge status={getPageStatus(page)} className="mt-1 self-start" />}
                      </>
                    );

                    if (href) {
                      return (
                        <Link key={page.id} href={href} className={cardClassName}>
                          {body}
                        </Link>
                      );
                    }

                    if (isPreview && onOpenPage) {
                      return (
                        <button key={page.id} type="button" onClick={() => onOpenPage(page)} className={cardClassName}>
                          {body}
                        </button>
                      );
                    }

                    return (
                      <div key={page.id} className={cardClassName}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
