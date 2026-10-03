/**
 * The shareable public URL of a published Page on the platform domain
 * (/public/{orgSlug}/pages/{pageSlug}). Returns null when either slug is
 * missing — callers must hide the link rather than fall back to a private
 * workspace route, which a signed-out visitor could not open.
 *
 * Pass `origin` (e.g. window.location.origin) for an absolute, copyable URL;
 * omit it for an in-app path suitable for router.push / href.
 */
export function buildPublicPageUrl(
  orgSlug: string | null | undefined,
  pageSlug: string | null | undefined,
  origin?: string,
): string | null {
  if (!orgSlug || !pageSlug) return null;
  const path = `/public/${orgSlug}/pages/${pageSlug}`;
  return origin ? `${origin.replace(/\/+$/, "")}${path}` : path;
}
