"use client";

import { use } from "react";
import { PublicPageView } from "@/components/public/public-page-view";

/**
 * Platform-domain equivalent of /public/pages/[pageSlug] — the orgSlug
 * segment is read by usePublicOrgContext (via useParams), not by this
 * component directly, which is why this file and the custom-domain one
 * share the exact same body.
 */
export default function PlatformDomainPublicPageReadPage({ params }: { params: Promise<{ orgSlug: string; pageSlug: string }> }) {
  const { pageSlug } = use(params);
  return <PublicPageView pageSlug={pageSlug} />;
}
