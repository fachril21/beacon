import "server-only";
import { resolveTxt as nodeResolveTxt } from "node:dns/promises";

export interface DomainVerificationResult {
  verified: boolean;
  reason: string | null;
}

export type TxtResolver = (hostname: string) => Promise<string[][]>;

/**
 * Real DNS ownership check (replaces the Stage 1 randomized placeholder —
 * see the removed TODO on useOrganizationDomainActions.verifyDomain). Looks
 * up the domain's TXT records and checks whether one matches the token
 * issued when the domain was added (Flow 7a step 3). No Vercel account is
 * required for this — DNS resolution is independent of Vercel's Domains API,
 * which remains the deferred piece for actual SSL/routing provisioning.
 */
export async function verifyDomainOwnership(
  domain: string,
  expectedToken: string,
  resolveTxt: TxtResolver = nodeResolveTxt,
): Promise<DomainVerificationResult> {
  let records: string[][];
  try {
    records = await resolveTxt(domain);
  } catch {
    return {
      verified: false,
      reason: "Tidak dapat menemukan TXT record untuk domain ini — perubahan DNS bisa memakan waktu beberapa jam.",
    };
  }

  const found = records.some((chunks) => chunks.join("") === expectedToken);
  if (!found) {
    return {
      verified: false,
      reason: "TXT record belum ditemukan — pastikan sudah ditambahkan persis seperti yang ditampilkan.",
    };
  }

  return { verified: true, reason: null };
}
