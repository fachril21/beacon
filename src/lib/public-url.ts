/**
 * Public site URLs. Every Space publishes its own tree — a Space's landing
 * and its Pages live under that Space's slug, so a visitor who opens one
 * Space can never navigate into a sibling Space's Pages (the old org-wide
 * `/public/{orgSlug}/pages/{pageSlug}` shape did exactly that).
 *
 * Pass `origin` (e.g. window.location.origin) for an absolute, copyable URL;
 * omit it for an in-app path suitable for router.push / href.
 */

function withOrigin(path: string, origin?: string): string {
  return origin ? `${origin.replace(/\/+$/, "")}${path}` : path;
}

/**
 * The shareable public URL of a Space on the platform domain
 * (/public/{orgSlug}/spaces/{spaceSlug}). Returns null when either slug is
 * missing — callers must hide the link rather than fall back to a private
 * workspace route, which a signed-out visitor could not open.
 */
export function buildPublicSpaceUrl(
  orgSlug: string | null | undefined,
  spaceSlug: string | null | undefined,
  origin?: string,
): string | null {
  if (!orgSlug || !spaceSlug) return null;
  return withOrigin(`/public/${orgSlug}/spaces/${spaceSlug}`, origin);
}

/**
 * The shareable public URL of a published Page, nested inside its own Space
 * (/public/{orgSlug}/spaces/{spaceSlug}/pages/{pageSlug}). Returns null when
 * any slug is missing — never a private-route fallback.
 */
export function buildPublicPageUrl(
  orgSlug: string | null | undefined,
  spaceSlug: string | null | undefined,
  pageSlug: string | null | undefined,
  origin?: string,
): string | null {
  if (!orgSlug || !spaceSlug || !pageSlug) return null;
  return withOrigin(`/public/${orgSlug}/spaces/${spaceSlug}/pages/${pageSlug}`, origin);
}

/**
 * In-app Page path for the public components, which already know their
 * `basePath` ("/public" on a custom domain, "/public/{orgSlug}" on the
 * platform domain). Keeping this in one place means every public link stays
 * Space-scoped.
 */
export function publicPageHref(
  basePath: string | null | undefined,
  spaceSlug: string | null | undefined,
  pageSlug: string | null | undefined,
): string | null {
  if (!basePath || !spaceSlug || !pageSlug) return null;
  return `${basePath.replace(/\/+$/, "")}/spaces/${spaceSlug}/pages/${pageSlug}`;
}

/** In-app Space landing path for the public components (see `publicPageHref`). */
export function publicSpaceHref(
  basePath: string | null | undefined,
  spaceSlug: string | null | undefined,
): string | null {
  if (!basePath || !spaceSlug) return null;
  return `${basePath.replace(/\/+$/, "")}/spaces/${spaceSlug}`;
}
