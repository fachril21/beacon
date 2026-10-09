import { NextResponse } from "next/server";

/**
 * Deprecated: Space-level invites have been removed in favor of single-source
 * Organization-level invites (/api/organizations/[id]/invite).
 * Any member invited to an Organization automatically has access to all Spaces
 * and Pages within that Organization.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "SPACE_INVITES_DEPRECATED",
      message: "Fitur undangan anggota pada Space telah dipindahkan ke tingkat Organisasi (Settings > Organization > Members).",
    },
    { status: 410 },
  );
}
