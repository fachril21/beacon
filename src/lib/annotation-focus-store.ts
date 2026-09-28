"use client";

/**
 * Which screenshot block (if any) has its full-screen annotation focus mode
 * open — not React state. This store is read by a component mounted once at
 * the PageEditor level (a sibling of BlockNoteView, which never remounts —
 * see docs/testing/annotation-editor-flicker-mitigation.tdd.md), so the
 * focus mode itself is structurally immune to the ~150-400ms dev-mode
 * NodeView remount that individual screenshot blocks go through. The
 * trigger (the "Edit anotasi" pill inside a remounting ScreenshotBlockRender)
 * only ever needs to write one id here, never hold any of the annotator's
 * own state itself.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "@/lib/store";

const focusStore = createStore<string | null>(null);

export function getAnnotationFocusBlockId(): string | null {
  return focusStore.getState();
}

export function openAnnotationFocus(blockId: string): void {
  focusStore.setState(blockId);
}

export function closeAnnotationFocus(): void {
  focusStore.setState(null);
}

export function useAnnotationFocusBlockId(): string | null {
  return useSyncExternalStore(focusStore.subscribe, focusStore.getState, focusStore.getState);
}
