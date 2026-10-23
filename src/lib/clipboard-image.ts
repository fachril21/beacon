/**
 * Clipboard payloads that carry an image expose it as a `File` either through
 * `items` (Chrome/Edge/Safari, and the common "copy screenshot" path) or only
 * through `files` (some browsers when copying from Finder/Explorer). Read both
 * so pasting works regardless of which surface the source app populated.
 */
export function getImageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];

  const fromItems = Array.from(data.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);

  if (fromItems.length > 0) return fromItems;

  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}
