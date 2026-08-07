import type { BaseSelection } from "lexical";
import { $isRangeSelection } from "lexical";
import { $isLinkNode, type LinkNode } from "@lexical/link";

/** Resolves the LinkNode containing the selection's anchor, if any. */
export function $getSelectedLinkNode(selection: BaseSelection | null): LinkNode | null {
  if (!$isRangeSelection(selection)) return null;

  const anchorNode = selection.anchor.getNode();
  if ($isLinkNode(anchorNode)) return anchorNode;

  const parent = anchorNode.getParent();
  if ($isLinkNode(parent)) return parent;

  return null;
}
