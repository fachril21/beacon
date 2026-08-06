"use client";

import { use } from "react";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicPage } from "@/hooks/use-public-content";
import { PublicPageContent } from "@/components/public/public-page-content";
import { FeedbackWidget } from "@/components/public/feedback-widget";
import { PageNotAvailable } from "@/components/public/page-not-available";

export default function PublicPageReadPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params);
  const { organization } = usePublicOrgContext();
  const result = usePublicPage(pageId, organization?.id);

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
