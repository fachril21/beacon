import { extractPlainText } from "@/lib/extract-text";
import type { PageContent } from "@/lib/types";

/** Flow 4's "empty/near-empty Page" check — title-only or a couple of stray words. */
export function isPageNearlyEmpty(title: string, content: PageContent): boolean {
  const bodyText = extractPlainText(content);
  return title.trim().length === 0 && bodyText.trim().length < 10;
}
