import { createStore } from "@/lib/store";
import type { AnnotationJson, AnnotationToolType } from "@/lib/types";

/**
 * In-progress (unsaved) annotation edits, keyed by the screenshot block's
 * stable ProseMirror id. AnnotationCanvas's own React state (drawn shapes,
 * active tool, next marker number) is lost whenever its host NodeView gets
 * torn down and recreated — see screenshot-block.tsx's annotatingBlockIds
 * comment for why that happens in dev mode. Persisting drafts here, outside
 * the component tree, means unsaved work survives that remount instead of
 * silently reverting to the last explicitly-saved annotation — which is
 * what "flickering while placing a numbered tag" actually was: each new
 * marker click landing in a fresh, remounted canvas that only knew about
 * the last *saved* state.
 */
const draftStore = createStore<ReadonlyMap<string, AnnotationJson>>(new Map());

export function getAnnotationDraft(blockId: string): AnnotationJson | undefined {
  return draftStore.getState().get(blockId);
}

export function setAnnotationDraft(blockId: string, draft: AnnotationJson): void {
  draftStore.setState((prev) => {
    const next = new Map(prev);
    next.set(blockId, draft);
    return next;
  });
}

export function clearAnnotationDraft(blockId: string): void {
  draftStore.setState((prev) => {
    if (!prev.has(blockId)) return prev;
    const next = new Map(prev);
    next.delete(blockId);
    return next;
  });
}

export interface AnnotationToolState {
  activeTool: AnnotationToolType | null;
  activeColor: string;
}

/**
 * Which tool/color is currently selected in the toolbar, keyed by block id.
 * The drawn shapes surviving a remount (above) wasn't enough on its own —
 * `activeTool` is also local React state, so a remount mid-session
 * deselects the tool the user just picked. The very next click (e.g. to
 * place a numbered tag) then hits `handleMouseDown`'s `if (!tool) return`
 * and silently does nothing, which reads as the whole editor "flickering."
 */
const toolStateStore = createStore<ReadonlyMap<string, AnnotationToolState>>(new Map());

export function getAnnotationToolState(blockId: string): AnnotationToolState | undefined {
  return toolStateStore.getState().get(blockId);
}

export function setAnnotationToolState(blockId: string, state: AnnotationToolState): void {
  toolStateStore.setState((prev) => {
    const next = new Map(prev);
    next.set(blockId, state);
    return next;
  });
}

export function clearAnnotationToolState(blockId: string): void {
  toolStateStore.setState((prev) => {
    if (!prev.has(blockId)) return prev;
    const next = new Map(prev);
    next.delete(blockId);
    return next;
  });
}
