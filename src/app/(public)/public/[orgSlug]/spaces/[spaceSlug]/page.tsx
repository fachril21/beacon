"use client";

import { PublicSpaceView } from "@/components/public/public-space-view";

/**
 * Platform-domain Space landing (/public/{orgSlug}/spaces/{spaceSlug}) — both
 * URL segments are read by usePublicOrgContext / usePublicCurrentSpace in the
 * layout shell, which is why this file shares the exact same body as the
 * custom-domain twin.
 */
export default function PlatformDomainPublicSpacePage() {
  return <PublicSpaceView />;
}
