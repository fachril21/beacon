"use client";

import { use } from "react";
import { PublicPageView } from "@/components/public/public-page-view";

/**
 * Platform-domain Page read inside its Space
 * (/public/{orgSlug}/spaces/{spaceSlug}/pages/{pageSlug}). The orgSlug and
 * spaceSlug segments are read by usePublicOrgContext / usePublicCurrentSpace
 * (via useParams) in the layout shell; pageSlug is passed explicitly so
 * usePublicPage can require the Page to belong to that Space.
 */
export default function PlatformDomainPublicSpacePageReadPage({
  params,
}: {
  params: Promise<{ orgSlug: string; spaceSlug: string; pageSlug: string }>;
}) {
  const { spaceSlug, pageSlug } = use(params);
  return <PublicPageView pageSlug={pageSlug} spaceSlug={spaceSlug} />;
}
