/**
 * The label shown for a Page that has no title yet.
 *
 * It is both the editor's title placeholder and the fallback every listing
 * (sidebar tree, breadcrumbs, public cards) renders, so a brand-new Page
 * reads identically everywhere instead of showing one string in the editor
 * and a different "untitled" sentence everywhere else.
 */
export const UNTITLED_PAGE_LABEL = "Untitled page";

/** `title`, or the untitled label when it is missing/whitespace-only. */
export function titleOrUntitled(title: string | null | undefined): string {
  return title?.trim() ? title : UNTITLED_PAGE_LABEL;
}
