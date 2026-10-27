"use client";

import { useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  AddBlockButton,
  DragHandleButton,
  DragHandleMenu,
  SideMenu,
  SideMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { useBlockComments } from "@/hooks/use-comments";
import { focusBlockComments } from "@/lib/comment-focus-store";
import { removeStepBlock } from "./stepper-block";
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
 * Steps are removed through the six-dot menu instead of a per-step trash
 * button: the side menu is the one affordance that is already there for every
 * row, and it keeps the title row clean while typing. Other block types keep
 * BlockNote's default menu (delete, colors, table headers).
 */
function BeaconDragHandleMenu() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  const sideMenu = useExtension(SideMenuExtension);
  const block = useExtensionState(SideMenuExtension, { editor, selector: (state) => state?.block });

  // Deleting a block while its drag-handle menu is open unmounts the menu
  // along with its anchor, so Radix may never report the close and BlockNote's
  // side menu stays frozen: the six-dot would then stop following the pointer
  // until a reload. Only unfreeze in that specific case — unmounting is also
  // what happens when the menu merely hides itself, and React StrictMode tears
  // effects down once right after mounting, so an unconditional cleanup would
  // close the side menu the moment it appears.
  useEffect(
    () => () => {
      if (block && editor.getBlock(block.id) === undefined) sideMenu.unfreezeMenu();
    },
    [block, editor, sideMenu],
  );

  if (!Components || !block || block.type !== "step") {
    return <DragHandleMenu />;
  }

  return (
    <Components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-drag-handle-menu">
      <Components.Generic.Menu.Item className="bn-menu-item" onClick={() => removeStepBlock(editor, block.id)}>
        Hapus langkah
      </Components.Generic.Menu.Item>
    </Components.Generic.Menu.Dropdown>
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
          <DragHandleButton dragHandleMenu={BeaconDragHandleMenu} />
        </SideMenu>
      )}
    />
  );
}
