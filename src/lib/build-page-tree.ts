import type { Page } from "@/lib/types";

export interface PageTreeNode {
  page: Page;
  children: PageTreeNode[];
}

/**
 * Nests a flat list of already-published Pages into a parent/child tree,
 * mirroring how the editor sidebar treats Page.order — sibling-scoped, not
 * comparable across different parents (src/hooks/use-pages.ts's
 * useChildPages/useReorderPages). Used by the public site so a Space's
 * published Pages render in the same hierarchy as the editor, instead of one
 * flat list sorted by a number that was never meaningful across parents.
 *
 * A Page whose parentPageId isn't present in `pages` (its parent isn't
 * published) is hidden entirely, along with all of its descendants — it is
 * never promoted to the root level, since that would show a page as if it
 * had no parent when in the editor it clearly does.
 */
export function buildPageTree(pages: Page[]): PageTreeNode[] {
  const byParentId = new Map<string, Page[]>();
  for (const page of pages) {
    if (page.parentPageId === null) continue;
    const siblings = byParentId.get(page.parentPageId) ?? [];
    siblings.push(page);
    byParentId.set(page.parentPageId, siblings);
  }

  function buildChildren(parentId: string): PageTreeNode[] {
    const siblings = byParentId.get(parentId) ?? [];
    return [...siblings]
      .sort((a, b) => a.order - b.order)
      .map((page) => ({ page, children: buildChildren(page.id) }));
  }

  const roots = pages.filter((page) => page.parentPageId === null);
  return [...roots].sort((a, b) => a.order - b.order).map((page) => ({ page, children: buildChildren(page.id) }));
}

export interface FlatPageTreeEntry {
  page: Page;
  depth: number;
}

/**
 * Flattens a PageTreeNode[] into a depth-annotated, parent-before-child list
 * — the shape both PublicToc and PublicHomeContent render from, so the
 * recursive tree-walk lives in exactly one place instead of being
 * duplicated across two near-identical presentational components.
 */
export function flattenPageTree(nodes: PageTreeNode[], depth = 0): FlatPageTreeEntry[] {
  return nodes.flatMap((node) => [{ page: node.page, depth }, ...flattenPageTree(node.children, depth + 1)]);
}
