import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { verifyDomainOwnership } from "@/lib/dns/verify-domain";

/**
 * Real domain-ownership check for Organization Domain Settings (Flow 7a,
 * Epic 14a). Replaces the Stage 1 client-side randomized placeholder in
 * useOrganizationDomainActions.verifyDomain with an actual DNS TXT lookup —
 * runs server-side because DNS resolution needs Node's `dns` module, not
 * something the browser or Edge runtime can do directly.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rateLimitOk, error: rateLimitError } = await supabase.rpc("check_domain_verification_rate_limit", {
    p_organization_id: id,
  });
  if (rateLimitError) {
    return NextResponse.json({ error: "Gagal memeriksa batas percobaan verifikasi." }, { status: 500 });
  }
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Terlalu banyak percobaan verifikasi. Coba lagi dalam beberapa menit." }, { status: 429 });
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("domain, pending_dns_token")
    .eq("id", id)
    .single();
  if (orgError || !organization) {
    return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });
  }
  if (!organization.domain || !organization.pending_dns_token) {
    return NextResponse.json({ error: "Tidak ada domain yang menunggu verifikasi." }, { status: 400 });
  }

  const result = await verifyDomainOwnership(organization.domain, organization.pending_dns_token);
  if (!result.verified) {
    return NextResponse.json({ verified: false, reason: result.reason });
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ is_domain_verified: true, pending_dns_token: null })
    .eq("id", id);
  if (updateError) {
    // RLS (organizations_update_owner_only) rejects non-owner callers here.
    return NextResponse.json({ error: "Anda tidak memiliki izin untuk memverifikasi domain ini." }, { status: 403 });
  }

  return NextResponse.json({ verified: true });
}
