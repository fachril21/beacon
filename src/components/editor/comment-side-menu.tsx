"use client";

import { MessageSquare } from "lucide-react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  AddBlockButton,
  DragHandleButton,
  SideMenu,
  SideMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from "@blocknote/react";
import { useBlockComments } from "@/hooks/use-comments";
import { focusBlockComments } from "@/lib/comment-focus-store";
import { usePageId } from "./page-id-context";

/**
 * Comments key off the ScreenshotBlock id for screenshot blocks (so they
 * match the corner popover there) and off the BlockNote block id for
 * everything else.
 */
function commentBlockIdFor(block: { id: string; type: string; props: unknown }): string {
  if (block.type === "screenshot") {
    const { screenshotBlockId } = block.props as { screenshotBlockId?: string };
    if (screenshotBlockId) return screenshotBlockId;
  }
  return block.id;
}

function CommentButton() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  const pageId = usePageId();
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block });
  const commentBlockId = block ? commentBlockIdFor(block) : undefined;
  const count = useBlockComments(pageId, commentBlockId).length;

  if (!block || !commentBlockId || !Components) return null;

  return (
    <Components.SideMenu.Button
      className="bn-button"
      label={count > 0 ? `Komentar (${count})` : "Komentar"}
      icon={
        <span className="relative flex">
          <MessageSquare size={18} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </span>
      }
      onClick={() => focusBlockComments(pageId, commentBlockId)}
    />
  );
}

/**
 * BlockNote's block side menu (the "+" and drag handle that appear on hover)
 * with a comment button added. Clicking it opens the Komentar tab aimed at
 * that block — a popover inside the side menu would vanish as soon as the
 * pointer leaves the block.
 */
export function CommentSideMenu() {
  return (
    <SideMenuController
      sideMenu={(props) => (
        <SideMenu {...props}>
          <CommentButton />
          <AddBlockButton />
          <DragHandleButton dragHandleMenu={props.dragHandleMenu} />
        </SideMenu>
      )}
    />
  );
}
