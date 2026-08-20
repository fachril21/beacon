const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg"]);

export class InvalidDocPathError extends Error {}

/**
 * Builds a docs/ object key from a [...key] route's decoded path segments.
 * Isolates this route to the docs/ prefix (the bucket also holds
 * screenshots/) and rejects traversal or unexpected file types so this
 * public, unauthenticated route can't be used to fetch arbitrary bucket
 * contents.
 */
export function buildDocObjectKey(segments: string[]): string {
  if (segments.length === 0) {
    throw new InvalidDocPathError("Empty document path");
  }
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\")) {
      throw new InvalidDocPathError(`Unsafe path segment: ${segment}`);
    }
  }

  const fileName = segments[segments.length - 1];
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  const ext = match?.[1]?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new InvalidDocPathError(`Disallowed file extension: ${fileName}`);
  }

  return `docs/${segments.join("/")}`;
}
