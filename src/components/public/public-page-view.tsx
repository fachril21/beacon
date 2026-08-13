"use client";

import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicPage } from "@/hooks/use-public-content";
import { PublicPageContent } from "./public-page-content";
import { FeedbackWidget } from "./feedback-widget";
import { PageNotAvailable } from "./page-not-available";

/**
 * Shared body for both the custom-domain (/public/pages/[pageSlug]) and
 * platform-domain (/public/[orgSlug]/pages/[pageSlug]) page routes —
 * usePublicOrgContext already resolves the right Organization for either
 * one, so the only thing that differs between the two route files is which
 * URL segment supplied pageSlug.
 */
export function PublicPageView({ pageSlug }: { pageSlug: string }) {
  const { organization } = usePublicOrgContext();
  const result = usePublicPage(pageSlug, organization?.id);

  if (!organization) return null;

  if (!result) {
    return <PageNotAvailable organizationName={organization.name} />;
  }

  const { page } = result;
  const snapshot = page.publishedContentSnapshot!;

  return (
    <main className="flex-1 px-8 py-12">
      <article className="mx-auto max-w-reading-column">
        <h1 className="text-display font-bold tracking-tight text-foreground">{snapshot.title}</h1>
        <div className="mt-8">
          <PublicPageContent pageId={page.id} content={snapshot.content} />
        </div>
      </article>
      <FeedbackWidget pageId={page.id} />
    </main>
  );
}
