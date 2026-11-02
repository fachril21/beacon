"use client";

import { use } from "react";
import { PublicPageView } from "@/components/public/public-page-view";

/**
 * Custom-domain Page read inside its Space
 * (/public/spaces/{spaceSlug}/pages/{pageSlug}) — the Organization comes from
 * the verified-host header, while spaceSlug and pageSlug come from the URL.
 */
export default function CustomDomainPublicSpacePageReadPage({
  params,
}: {
  params: Promise<{ spaceSlug: string; pageSlug: string }>;
}) {
  const { spaceSlug, pageSlug } = use(params);
  return <PublicPageView pageSlug={pageSlug} spaceSlug={spaceSlug} />;
}
