"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicPage } from "@/hooks/use-public-content";
import { usePublicSpace } from "@/hooks/public-space-context";
import { flattenPageTree } from "@/lib/build-page-tree";
import { collectHeadings } from "@/lib/collect-headings";
import { PublicPageContent } from "./public-page-content";
import { FeedbackWidget } from "./feedback-widget";
import { PageNotAvailable } from "./page-not-available";

function formatPublicDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function scrollToHeading(id: string) {
  document.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Shared body for both the custom-domain (/public/pages/[pageSlug]) and
 * platform-domain (/public/[orgSlug]/pages/[pageSlug]) page routes —
 * usePublicOrgContext already resolves the right Organization for either
 * one, so the only thing that differs between the two route files is which
 * URL segment supplied pageSlug.
 */
export function PublicPageView({ pageSlug }: { pageSlug: string }) {
  const { organization, basePath } = usePublicOrgContext();
  const result = usePublicPage(pageSlug, organization?.id);
  const currentSpace = usePublicSpace();

  if (!organization) return null;

  if (!result) {
    return <PageNotAvailable organizationName={organization.name} />;
  }

  const { page, space } = result;
  const snapshot = page.publishedContentSnapshot!;
  const headings = collectHeadings(snapshot.content);

  // currentSpace (resolved by the layout shell from this same pageSlug) is
  // the same Space's full published tree — reused for the breadcrumb's
  // parent crumb and the previous/next cards instead of a second fetch.
  const rows = currentSpace ? flattenPageTree(currentSpace.pages).filter(({ page: p }) => p.slug) : [];
  const currentIndex = rows.findIndex(({ page: p }) => p.id === page.id);
  const previous = currentIndex > 0 ? rows[currentIndex - 1] : null;
  const next = currentIndex !== -1 && currentIndex < rows.length - 1 ? rows[currentIndex + 1] : null;
  const parentEntry = page.parentPageId ? rows.find(({ page: p }) => p.id === page.parentPageId) : undefined;

  return (
    <main className="flex-1 px-6 py-10 lg:px-8 lg:py-12">
      <div className="flex gap-10">
        <article className="min-w-0 max-w-(--width-reading-column) flex-1">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
            <Link href={basePath} className="hover:text-foreground">
              {organization.name} Docs
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            <Link href={`${basePath}/spaces/${space.slug}`} className="hover:text-foreground">
              {space.name}
            </Link>
            {parentEntry && (
              <>
                <ChevronRight className="size-3" aria-hidden />
                <Link href={`${basePath}/pages/${parentEntry.page.slug}`} className="hover:text-foreground">
                  {parentEntry.page.title || "Halaman tanpa judul"}
                </Link>
              </>
            )}
          </nav>

          <h1 className="text-display font-bold tracking-tight text-foreground">{snapshot.title}</h1>
          {/* Author intentionally omitted — decision D3 (wireframe v2 §3.5/§6.1): never expose an internal employee's name on the public site. */}
          {page.publishedAt && (
            <p className="mt-2 text-body-sm text-muted-foreground">Diperbarui {formatPublicDate(page.publishedAt)}</p>
          )}

          {/* "Di halaman ini" as an accordion below 1280px — the sticky rail (below) takes over at xl. */}
          {headings.length > 0 && (
            <details className="mt-6 rounded-md border border-border xl:hidden">
              <summary className="cursor-pointer px-4 py-3 text-body-sm font-medium text-foreground select-none">Di halaman ini</summary>
              <nav aria-label="Di halaman ini" className="flex flex-col gap-0.5 px-4 pb-3">
                {headings.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => scrollToHeading(h.id)}
                    style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                    className="rounded-sm py-1.5 text-left text-body-sm text-muted-foreground hover:text-foreground"
                  >
                    {h.text}
                  </button>
                ))}
              </nav>
            </details>
          )}

          <div className="mt-8">
            <PublicPageContent pageId={page.id} content={snapshot.content} />
          </div>

          <FeedbackWidget pageId={page.id} />

          {(previous || next) && (
            <div className="mt-10 grid grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2">
              {previous && (
                <Link href={`${basePath}/pages/${previous.page.slug}`} className="rounded-lg border border-border p-4 hover:bg-accent">
                  <p className="text-caption text-muted-foreground">Sebelumnya</p>
                  <p className="mt-1 text-body-sm font-medium text-foreground">{previous.page.title || "Halaman tanpa judul"}</p>
                </Link>
              )}
              {next && (
                <Link
                  href={`${basePath}/pages/${next.page.slug}`}
                  className={cn("rounded-lg border border-border p-4 text-right hover:bg-accent", !previous && "sm:col-start-2")}
                >
                  <p className="text-caption text-muted-foreground">Berikutnya</p>
                  <p className="mt-1 text-body-sm font-medium text-foreground">{next.page.title || "Halaman tanpa judul"}</p>
                </Link>
              )}
            </div>
          )}
        </article>

        {headings.length > 0 && (
          <aside className="hidden w-toc-rail shrink-0 xl:block">
            <nav aria-label="Di halaman ini" className="sticky top-24 flex flex-col gap-0.5">
              <p className="mb-1.5 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">Di halaman ini</p>
              {headings.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => scrollToHeading(h.id)}
                  style={{ paddingLeft: `${(h.level - 1) * 10}px` }}
                  className="truncate rounded-sm py-1 text-left text-body-sm text-muted-foreground hover:text-foreground"
                >
                  {h.text}
                </button>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </main>
  );
}
