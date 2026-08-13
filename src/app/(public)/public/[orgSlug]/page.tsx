"use client";

import { PublicHomeContent } from "@/components/public/public-home-content";

/**
 * Platform-domain equivalent of /public — the orgSlug segment is read by
 * usePublicOrgContext (via useParams), not by this component directly,
 * which is why this file and the custom-domain one share the exact same
 * body.
 */
export default function PlatformDomainPublicHomePage() {
  return <PublicHomeContent />;
}
