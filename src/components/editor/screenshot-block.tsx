"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { createReactBlockSpec, type ReactCustomBlockRenderProps } from "@blocknote/react";
import {
  useScreenshotBlock,
  useUploadScreenshot,
  useUpdateScreenshotDescription,
  useUpdateScreenshotAnnotations,
  usePatchScreenshotAnnotationsLocal,
} from "@/hooks/use-screenshot-blocks";
import { resolveScreenshotUrl } from "@/lib/s3/screenshot-url";
import { createStore } from "@/lib/store";
import { useActiveAnnotationTool } from "@/lib/annotation-tool-store";
import type { Annotation } from "@/lib/types";
import { usePageId } from "./page-id-context";
import { ScreenshotUploadPrompt } from "./screenshot-upload-prompt";
import { AnnotationOverlay } from "./annotation-overlay";
import { AnnotationEditorOverlay } from "./annotation-editor-overlay";
import { CommentThreadPanel } from "./comment-thread-panel";
import { Textarea } from "@/components/ui/textarea";

export const screenshotBlockConfig = {
  type: "screenshot",
  propSchema: {
    screenshotBlockId: { default: "" },
  },
  content: "none",
} as const;

type ScreenshotBlockRenderProps = ReactCustomBlockRenderProps<typeof screenshotBlockConfig>;

/**
 * Whether the annotator is open, keyed by the block's own stable ProseMirror
 * id — not React state. BlockNote recreates this block's NodeView
 * repeatedly in dev mode (docs/testing/annotation-remount-resilience.tdd.md);
 * local `useState` here would get wiped mid-interaction the same way the
 * previous annotation implementation's open/closed flag did.
 */
const annotatingBlockIds = createStore<ReadonlySet<string>>(new Set());

function setAnnotating(blockId: string, isAnnotating: boolean) {
  annotatingBlockIds.setState((prev) => {
    const next = new Set(prev);
    if (isAnnotating) next.add(blockId);
    else next.delete(blockId);
    return next;
  });
}

function useIsAnnotating(blockId: string) {
  const ids = useSyncExternalStore(annotatingBlockIds.subscribe, annotatingBlockIds.getState, annotatingBlockIds.getState);
  return ids.has(blockId);
}

function ScreenshotBlockRender({ block, editor }: ScreenshotBlockRenderProps) {
  const blockId = block.props.screenshotBlockId;
  const readOnly = !editor.isEditable;
  const pageId = usePageId();
  const screenshotBlock = useScreenshotBlock(blockId || undefined, pageId);
  const uploadScreenshot = useUploadScreenshot();
  const updateDescription = useUpdateScreenshotDescription();
  const updateAnnotations = useUpdateScreenshotAnnotations();
  const patchAnnotationsLocal = usePatchScreenshotAnnotationsLocal();
  const isAnnotating = useIsAnnotating(block.id);
  const [activeTool, setActiveTool] = useActiveAnnotationTool(block.id);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState(screenshotBlock?.description ?? "");
  const descriptionSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annotationsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (descriptionSaveRef.current) clearTimeout(descriptionSaveRef.current);
      if (annotationsSaveRef.current) clearTimeout(annotationsSaveRef.current);
    };
  }, []);

  function handleDescriptionChange(value: string) {
    setDescription(value);
    if (!screenshotBlock) return;
    if (descriptionSaveRef.current) clearTimeout(descriptionSaveRef.current);
    descriptionSaveRef.current = setTimeout(() => {
      updateDescription(screenshotBlock.id, value).catch(() => toast.error("Gagal menyimpan deskripsi, silakan coba lagi."));
    }, 800);
  }

  function assignBlockId(id: string) {
    editor.updateBlock(block, { type: "screenshot", props: { screenshotBlockId: id } });
  }

  async function handleUpload(file: File, width: number, height: number) {
    setIsUploading(true);
    try {
      const newBlock = await uploadScreenshot({ pageId, order: 0, file, width, height });
      assignBlockId(newBlock.id);
    } catch {
      toast.error("Gagal mengunggah gambar, silakan coba lagi.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleAnnotationsChange(next: Annotation[]) {
    if (!screenshotBlock) return;
    // Immediate, remount-safe: the same store already backing the image and
    // description, which never flickered — see
    // docs/testing/annotation-box-shape-dot-fix.tdd.md for what happens when
    // an in-progress shape's position only lives in local component state.
    patchAnnotationsLocal(screenshotBlock.id, next);
    if (annotationsSaveRef.current) clearTimeout(annotationsSaveRef.current);
    annotationsSaveRef.current = setTimeout(() => {
      updateAnnotations(screenshotBlock.id, next).catch(() => toast.error("Gagal menyimpan anotasi, silakan coba lagi."));
    }, 500);
  }

  if (!blockId || !screenshotBlock) {
    return readOnly ? null : <ScreenshotUploadPrompt onUpload={(file, w, h) => void handleUpload(file, w, h)} isUploading={isUploading} />;
  }

  if (readOnly) {
    return (
      <div className="my-4 w-full max-w-screenshot-breakout">
        <div className="relative overflow-hidden rounded-lg border border-card bg-background">
          <Image
            src={resolveScreenshotUrl(screenshotBlock.imageUrl)}
            alt={screenshotBlock.altText ?? ""}
            width={screenshotBlock.imageWidth}
            height={screenshotBlock.imageHeight}
            className="h-auto w-full"
            unoptimized
          />
          <AnnotationOverlay annotations={screenshotBlock.annotations} imageWidth={screenshotBlock.imageWidth} imageHeight={screenshotBlock.imageHeight} />
        </div>
        {screenshotBlock.description && <p className="mt-2 text-body-sm text-muted-foreground">{screenshotBlock.description}</p>}
      </div>
    );
  }

  if (isAnnotating) {
    return (
      <div className="my-4 w-full max-w-screenshot-breakout">
        <AnnotationEditorOverlay
          annotations={screenshotBlock.annotations}
          imageWidth={screenshotBlock.imageWidth}
          imageHeight={screenshotBlock.imageHeight}
          activeTool={activeTool}
          onActiveToolChange={setActiveTool}
          onAnnotationsChange={handleAnnotationsChange}
        >
          <Image
            src={resolveScreenshotUrl(screenshotBlock.imageUrl)}
            alt={screenshotBlock.altText ?? ""}
            width={screenshotBlock.imageWidth}
            height={screenshotBlock.imageHeight}
            className="h-auto w-full"
            unoptimized
          />
        </AnnotationEditorOverlay>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setAnnotating(block.id, false)}
            className="rounded-md bg-primary px-3 py-1.5 text-body-sm text-primary-foreground"
          >
            Selesai memberi anotasi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative my-4 w-full max-w-screenshot-breakout">
      <button
        type="button"
        onClick={() => setAnnotating(block.id, true)}
        className="relative block w-full overflow-hidden rounded-lg border border-card bg-background text-left"
      >
        <Image
          src={resolveScreenshotUrl(screenshotBlock.imageUrl)}
          alt={screenshotBlock.altText ?? ""}
          width={screenshotBlock.imageWidth}
          height={screenshotBlock.imageHeight}
          className="h-auto w-full"
          unoptimized
        />
        <AnnotationOverlay annotations={screenshotBlock.annotations} imageWidth={screenshotBlock.imageWidth} imageHeight={screenshotBlock.imageHeight} />
        <div className="absolute inset-0 hidden items-center justify-center bg-background/60 group-hover:flex">
          <span className="flex items-center gap-1.5 rounded-md bg-popover px-3 py-1.5 text-body-sm text-popover-foreground shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]">
            <Pencil className="size-3.5" />
            Edit anotasi
          </span>
        </div>
      </button>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
        <CommentThreadPanel blockId={screenshotBlock.id} className="bg-popover shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]" />
      </div>
      <Textarea
        value={description}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        placeholder="Jelaskan langkah ini…"
        className="mt-2 min-h-16 border-none bg-transparent px-0 text-body-sm text-muted-foreground focus-visible:ring-0"
      />
    </div>
  );
}

export const screenshotBlockSpec = createReactBlockSpec(screenshotBlockConfig, {
  render: ScreenshotBlockRender,
})();
