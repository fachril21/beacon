/**
 * Slug generation/validation shared by Organization slugs (platform-domain
 * root, e.g. /public/{slug}) and Page slugs (/public/{orgSlug}/pages/{slug}) —
 * see supabase/migrations/20260813010000_organization_page_slugs.sql.
 */

const RESERVED_SLUGS = new Set([
  "pages",
  "api",
  "public",
  "settings",
  "spaces",
  "sign-in",
  "sign-up",
  "verify-email",
  "auth",
  "workspace",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Best-effort slug derived from arbitrary text (a title or name) — always returns a non-empty, SLUG_PATTERN-valid string. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "untitled";
}

export interface SlugValidationResult {
  valid: boolean;
  reason: string | null;
}

/** Validates a slug a User typed/edited directly — slugify() output is always valid, but user input isn't. */
export function validateSlug(slug: string): SlugValidationResult {
  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      reason: "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung tunggal (tidak di awal/akhir).",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, reason: `"${slug}" adalah kata yang dicadangkan platform dan tidak dapat digunakan.` };
  }
  return { valid: true, reason: null };
}
