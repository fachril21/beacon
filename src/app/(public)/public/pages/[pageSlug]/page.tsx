"use client";

import { use } from "react";
import { PublicPageView } from "@/components/public/public-page-view";

export default function PublicPageReadPage({ params }: { params: Promise<{ pageSlug: string }> }) {
  const { pageSlug } = use(params);
  return <PublicPageView pageSlug={pageSlug} />;
}
