"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { screenshotBlocksStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapScreenshotBlockRow, type ScreenshotBlockRow } from "@/lib/supabase/mappers";
import type { AnnotationJson, ScreenshotBlock } from "@/lib/types";

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
  /** An S3/MinIO object key (see useUploadScreenshot) — not a browser-fetchable URL. */
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

export function useUpdateScreenshotAnnotation() {
  return useCallback(async (id: string, annotationJson: AnnotationJson) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("screenshot_blocks").update({ annotation_json: annotationJson }).eq("id", id);
    if (error) throw error;

    screenshotBlocksStore.setState((prev) =>
      prev.map((b) => (b.id === id ? { ...b, annotationJson, updatedAt: new Date().toISOString() } : b)),
    );
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

export interface UploadScreenshotInput {
  pageId: string;
  order: number;
  file: File;
  width: number;
  height: number;
}

interface PresignResponse {
  url: string;
  fields: Record<string, string>;
  objectKey: string;
}

/**
 * Flow 3 step 4: request a presigned upload, PUT/POST the file directly to
 * S3/MinIO (never through our own server), then persist the resulting
 * object key. Throws (without creating a DB row) if either network step
 * fails, so the caller can show a retry affordance instead of a phantom
 * ScreenshotBlock pointing at a file that was never actually uploaded.
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
      const { url, fields, objectKey } = (await presignRes.json()) as PresignResponse;

      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) formData.append(key, value);
      formData.append("file", input.file);

      const uploadRes = await fetch(url, { method: "POST", body: formData });
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
