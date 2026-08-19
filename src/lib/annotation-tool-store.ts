"use client";

/**
 * Which annotation tool is currently selected, keyed by the screenshot
 * block's own stable ProseMirror id — not React state. BlockNote recreates
 * this block's NodeView repeatedly in dev mode (see
 * docs/testing/annotation-remount-resilience.tdd.md); local `useState` for
 * the active tool was the documented cause of the tool silently deselecting
 * mid-session in the previous annotation implementation. Reading it from a
 * store outside the component tree means the selection survives whatever
 * remounts the node view.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "@/lib/store";
import type { AnnotationShapeType } from "@/lib/types";

const toolByBlock = createStore<Record<string, AnnotationShapeType | null>>({});

export function getActiveAnnotationTool(blockId: string): AnnotationShapeType | null {
  return toolByBlock.getState()[blockId] ?? null;
}

export function setActiveAnnotationTool(blockId: string, tool: AnnotationShapeType | null): void {
  toolByBlock.setState((prev) => ({ ...prev, [blockId]: tool }));
}

export function useActiveAnnotationTool(blockId: string): [AnnotationShapeType | null, (tool: AnnotationShapeType | null) => void] {
  const tool = useSyncExternalStore(
    toolByBlock.subscribe,
    () => toolByBlock.getState()[blockId] ?? null,
    () => null,
  );
  return [tool, (next) => setActiveAnnotationTool(blockId, next)];
}
