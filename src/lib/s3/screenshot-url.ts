/**
 * src/lib/types.ts's ScreenshotBlock.imageUrl doc comment: "Stage 1: a local
 * object URL... Stage 2: an S3/MinIO object key." Components render
 * `<Image src={...}>` directly, so this turns whichever shape is currently
 * stored into something the browser can actually fetch.
 */
export function resolveScreenshotUrl(imageUrlOrKey: string): string {
  const looksLikeUrl =
    imageUrlOrKey.startsWith("http://") ||
    imageUrlOrKey.startsWith("https://") ||
    imageUrlOrKey.startsWith("blob:") ||
    imageUrlOrKey.startsWith("/");
  if (looksLikeUrl) return imageUrlOrKey;

  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL_BASE ?? "";
  return `${base.replace(/\/+$/, "")}/${imageUrlOrKey}`;
}
