import { extractBlockOwnText } from "@/lib/extract-text";
import type { PageContent } from "@/lib/types";

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

/** Walks a BlockNote block tree (children included) and returns every non-empty heading in document order — the outline behind the editor's "Daftar isi" tab, and reusable by the public "Di halaman ini" rail. */
export function collectHeadings(blocks: PageContent, out: TocHeading[] = []): TocHeading[] {
  for (const block of blocks) {
    if (block.type === "heading" && block.id) {
      const text = extractBlockOwnText(block.content);
      const level = Number((block.props as { level?: number } | undefined)?.level) || 1;
      if (text) out.push({ id: block.id, text, level });
    }
    if (block.children) collectHeadings(block.children as PageContent, out);
  }
  return out;
}
