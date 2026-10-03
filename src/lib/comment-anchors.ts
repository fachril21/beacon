import type { Comment, PageContent } from "@/lib/types";

type AnyBlock = PageContent[number];

/**
 * A Comment's blockId is a BlockNote block id, a ScreenshotBlock.id (see
 * Comment in lib/types.ts) or PAGE_COMMENT_BLOCK_ID. Resolve it to the
 * BlockNote block that renders it (null for the page-level pseudo block or a
 * block that has since been deleted).
 */
export function findAnchorBlock(blocks: PageContent, commentBlockId: string): AnyBlock | null {
  for (const block of blocks) {
    const props = block.props as { screenshotBlockId?: string } | undefined;
    if (block.id && (block.id === commentBlockId || props?.screenshotBlockId === commentBlockId)) return block;
    if (block.children) {
      const found = findAnchorBlock(block.children as PageContent, commentBlockId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Number of unread comments per editor block id, for the blocks that still
 * exist. A comment is unread when someone else wrote it after the user last
 * read that block's thread (`readAt` gives that time, or undefined if never).
 */
export function unreadBlockCounts(
  content: PageContent,
  comments: Comment[],
  readAt: (commentBlockId: string) => string | undefined,
  currentUserId: string | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const comment of comments) {
    if (comment.authorUserId === currentUserId) continue;
    const lastRead = readAt(comment.blockId);
    if (lastRead !== undefined && comment.createdAt <= lastRead) continue;
    const anchorId = findAnchorBlock(content, comment.blockId)?.id;
    if (anchorId) counts.set(anchorId, (counts.get(anchorId) ?? 0) + 1);
  }
  return counts;
}

/** Block ids come from stored content, so only plain id characters are allowed into a CSS selector. */
const SAFE_BLOCK_ID = /^[A-Za-z0-9_-]+$/;

/** A small filled speech bubble, used as a mask so the marker takes the theme's primary colour. */
const BUBBLE_MASK =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg>\") center / contain no-repeat";

/**
 * CSS that puts a comment marker in the right margin of the given blocks,
 * outside the text column so it never overlaps or tints the text. Done as a
 * stylesheet keyed on `data-id` rather than by editing BlockNote's DOM, which
 * the editor re-renders at will. Targets only the block's own content, so a
 * commented parent does not mark its children.
 */
export function commentCueCss(blockIds: string[]): string {
  return blockIds
    .filter((id) => SAFE_BLOCK_ID.test(id))
    .map((id) => {
      const own = `[data-id="${id}"] > .bn-block-content, [data-id="${id}"] > .bn-block > .bn-block-content`;
      const marker = `[data-id="${id}"] > .bn-block-content::after, [data-id="${id}"] > .bn-block > .bn-block-content::after`;
      return (
        `${own} { position: relative; }\n` +
        `${marker} { content: ""; position: absolute; right: -1.25rem; top: 0.5rem; width: 1rem; height: 1rem; ` +
        `background: var(--color-primary); -webkit-mask: ${BUBBLE_MASK}; mask: ${BUBBLE_MASK}; pointer-events: none; }`
      );
    })
    .join("\n");
}
