"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { createReactBlockSpec, type ReactCustomBlockRenderProps } from "@blocknote/react";
import { useScreenshotBlock, useUploadScreenshot, useUpdateScreenshotAnnotation, useUpdateScreenshotDescription } from "@/hooks/use-screenshot-blocks";
import { resolveScreenshotUrl } from "@/lib/s3/screenshot-url";
import { createStore } from "@/lib/store";
import { usePageId } from "./page-id-context";
import { ScreenshotUploadPrompt } from "./screenshot-upload-prompt";
import { AnnotationCanvas } from "./annotation-canvas";
import { AnnotationOverlay } from "./annotation-overlay";
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
 * id (not the local React component instance). BlockNote/Turbopack's dev
 * server recreates this block's NodeView roughly once a second in dev mode
 * only (confirmed absent from a production build) for reasons that survived
 * removing every piece of this file's own logic down to a static div — so
 * local `useState` here gets wiped mid-interaction. Reading this from a
 * store outside the component tree means the open/closed flag survives
 * whatever remounts the node view, in dev and in prod alike.
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
  const updateAnnotation = useUpdateScreenshotAnnotation();
  const updateDescription = useUpdateScreenshotDescription();
  const isAnnotating = useIsAnnotating(block.id);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState(screenshotBlock?.description ?? "");
  const descriptionSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (descriptionSaveRef.current) clearTimeout(descriptionSaveRef.current);
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
      setAnnotating(block.id, true);
    } catch {
      toast.error("Gagal mengunggah gambar, silakan coba lagi.");
    } finally {
      setIsUploading(false);
    }
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
          <AnnotationOverlay annotation={screenshotBlock.annotationJson} imageWidth={screenshotBlock.imageWidth} imageHeight={screenshotBlock.imageHeight} />
        </div>
        {screenshotBlock.description && <p className="mt-2 text-body-sm text-muted-foreground">{screenshotBlock.description}</p>}
      </div>
    );
  }

  if (isAnnotating) {
    return (
      <AnnotationCanvas
        blockId={block.id}
        imageUrl={resolveScreenshotUrl(screenshotBlock.imageUrl)}
        imageWidth={screenshotBlock.imageWidth}
        imageHeight={screenshotBlock.imageHeight}
        initialAnnotation={screenshotBlock.annotationJson}
        onDone={(annotation) => {
          updateAnnotation(screenshotBlock.id, annotation).catch(() => toast.error("Gagal menyimpan anotasi, silakan coba lagi."));
          setAnnotating(block.id, false);
        }}
        onCancel={() => setAnnotating(block.id, false)}
      />
    );
  }

  return (
    <div className="group relative my-4 w-full max-w-screenshot-breakout">
      <button
        type="button"
        onClick={() => setAnnotating(block.id, true)}
        className="relative block w-full overflow-hidden rounded-lg border border-card bg-background text-left"
      >
        <div className="relative">
          <Image
            src={resolveScreenshotUrl(screenshotBlock.imageUrl)}
            alt={screenshotBlock.altText ?? ""}
            width={screenshotBlock.imageWidth}
            height={screenshotBlock.imageHeight}
            className="h-auto w-full"
            unoptimized
          />
          <AnnotationOverlay annotation={screenshotBlock.annotationJson} imageWidth={screenshotBlock.imageWidth} imageHeight={screenshotBlock.imageHeight} />
        </div>
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
