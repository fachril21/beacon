"use client";

import { PublicSpaceView } from "@/components/public/public-space-view";

/**
 * Custom-domain Space landing (/public/spaces/{spaceSlug}) — the spaceSlug
 * segment is read by usePublicCurrentSpace (via useParams) in the layout
 * shell, so this file, like the platform-domain twin, has no body of its own.
 */
export default function CustomDomainPublicSpacePage() {
  return <PublicSpaceView />;
}
