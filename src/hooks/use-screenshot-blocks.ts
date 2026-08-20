"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { screenshotBlocksStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapScreenshotBlockRow, type ScreenshotBlockRow } from "@/lib/supabase/mappers";
import type { Annotation, ScreenshotBlock } from "@/lib/types";

/**
 * The store only ever gets patched in-place by the create/update mutations
 * below, so a fresh page load (no upload/edit in this session) starts with
 * an empty store — the block a page's content refers to was never fetched,
 * so it silently fails to render. `pageId` mirrors usePageVersions' pattern:
 * lazily load every screenshot_blocks row for the page once, so a reload
 * (or a Viewer who never uploaded anything) still resolves existing blocks.
 */
export function useScreenshotBlock(id: string | undefined, pageId: string | undefined) {
  const blocks = useSyncExternalStore(screenshotBlocksStore.subscribe, screenshotBlocksStore.getState, screenshotBlocksStore.getState);

  useEffect(() => {
    if (!pageId) return;
    screenshotBlocksStore.ensureLoaded(
      `page:${pageId}`,
      async () => {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.from("screenshot_blocks").select("*").eq("page_id", pageId);
        if (error) throw error;
        return ((data ?? []) as ScreenshotBlockRow[]).map(mapScreenshotBlockRow);
      },
      (error) => console.error("[beacon] failed to load screenshot blocks:", error),
    );
  }, [pageId]);

  return id ? blocks.find((b) => b.id === id) : undefined;
}

export interface CreateScreenshotBlockInput {
  pageId: string;
  order: number;
  /** An S3-compatible object key (see useUploadScreenshot) — not a browser-fetchable URL. */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
}

export function useCreateScreenshotBlock() {
  return useCallback(async (input: CreateScreenshotBlockInput): Promise<ScreenshotBlock> => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("screenshot_blocks")
      .insert({
        page_id: input.pageId,
        order: input.order,
        image_object_key: input.imageUrl,
        image_width: input.imageWidth,
        image_height: input.imageHeight,
        description: "",
      })
      .select()
      .single();
    if (error) throw error;

    const block = mapScreenshotBlockRow(data as ScreenshotBlockRow);
    screenshotBlocksStore.setState((prev) => [...prev, block]);
    return block;
  }, []);
}

export function useUpdateScreenshotDescription() {
  return useCallback(async (id: string, description: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("screenshot_blocks").update({ description }).eq("id", id);
    if (error) throw error;

    screenshotBlocksStore.setState((prev) =>
      prev.map((b) => (b.id === id ? { ...b, description, updatedAt: new Date().toISOString() } : b)),
    );
  }, []);
}

export function useUpdateScreenshotAnnotations() {
  return useCallback(async (id: string, annotations: Annotation[]) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("screenshot_blocks").update({ annotation_json: annotations }).eq("id", id);
    if (error) throw error;

    screenshotBlocksStore.setState((prev) =>
      prev.map((b) => (b.id === id ? { ...b, annotations, updatedAt: new Date().toISOString() } : b)),
    );
  }, []);
}

/**
 * Store-only patch, no Supabase round trip — used for every intermediate
 * frame while a shape is being drawn or dragged. BlockNote's dev-mode
 * NodeView remount (docs/testing/annotation-remount-resilience.tdd.md,
 * docs/testing/annotation-box-shape-dot-fix.tdd.md) lands well inside a
 * normal drag gesture, so the previous Fabric.js implementation's shapes
 * froze at their creation size or lost in-progress moves. Writing every
 * frame straight into this remount-safe store (the same one already backing
 * the image/description, which never flickered) means a remount always
 * re-renders from the shape's current position — never a stale snapshot.
 * `useUpdateScreenshotAnnotations` still does the actual (debounced) network
 * save once a gesture settles.
 */
export function usePatchScreenshotAnnotationsLocal() {
  return useCallback((id: string, annotations: Annotation[]) => {
    screenshotBlocksStore.setState((prev) => prev.map((b) => (b.id === id ? { ...b, annotations } : b)));
  }, []);
}

export interface UploadScreenshotInput {
  pageId: string;
  order: number;
  file: File;
  width: number;
  height: number;
}

interface PresignResponse {
  url: string;
  objectKey: string;
}

/**
 * Flow 3 step 4: request a presigned upload, PUT the file directly to
 * S3-compatible storage (never through our own server), then persist the
 * resulting object key. Throws (without creating a DB row) if either
 * network step fails, so the caller can show a retry affordance instead of
 * a phantom ScreenshotBlock pointing at a file that was never actually
 * uploaded.
 */
export function useUploadScreenshot() {
  const createBlock = useCreateScreenshotBlock();

  return useCallback(
    async (input: UploadScreenshotInput): Promise<ScreenshotBlock> => {
      const presignRes = await fetch("/api/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: input.pageId,
          fileName: input.file.name,
          contentType: input.file.type,
          fileSize: input.file.size,
        }),
      });
      if (!presignRes.ok) {
        throw new Error("Failed to get an upload URL");
      }
      const { url, objectKey } = (await presignRes.json()) as PresignResponse;

      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": input.file.type },
        body: input.file,
      });
      if (!uploadRes.ok) {
        throw new Error("Failed to upload the image");
      }

      return createBlock({
        pageId: input.pageId,
        order: input.order,
        imageUrl: objectKey,
        imageWidth: input.width,
        imageHeight: input.height,
      });
    },
    [createBlock],
  );
}
