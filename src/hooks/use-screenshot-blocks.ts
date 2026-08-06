"use client";

import { useSyncExternalStore, useCallback } from "react";
import { screenshotBlocksStore, nextId } from "@/lib/data-store";
import type { AnnotationJson, ScreenshotBlock } from "@/lib/types";

export function useScreenshotBlock(id: string | undefined) {
  const blocks = useSyncExternalStore(screenshotBlocksStore.subscribe, screenshotBlocksStore.getState, screenshotBlocksStore.getState);
  return id ? blocks[id] : undefined;
}

export interface CreateScreenshotBlockInput {
  pageId: string;
  order: number;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
}

export function useCreateScreenshotBlock() {
  return useCallback((input: CreateScreenshotBlockInput): ScreenshotBlock => {
    const now = new Date().toISOString();
    const block: ScreenshotBlock = {
      id: nextId("shot"),
      pageId: input.pageId,
      type: "screenshot",
      order: input.order,
      imageUrl: input.imageUrl,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
      annotationJson: null,
      description: "",
      altText: null,
      createdAt: now,
      updatedAt: now,
    };
    screenshotBlocksStore.setState((prev) => ({ ...prev, [block.id]: block }));
    return block;
  }, []);
}

export function useUpdateScreenshotAnnotation() {
  return useCallback((id: string, annotationJson: AnnotationJson) => {
    screenshotBlocksStore.setState((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], annotationJson, updatedAt: new Date().toISOString() } } : prev,
    );
  }, []);
}

export function useUpdateScreenshotDescription() {
  return useCallback((id: string, description: string) => {
    screenshotBlocksStore.setState((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], description, updatedAt: new Date().toISOString() } } : prev,
    );
  }, []);
}
