"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { createReactBlockSpec, type ReactCustomBlockRenderProps } from "@blocknote/react";
import { useScreenshotBlock, useUploadScreenshot, useUpdateScreenshotAnnotation, useUpdateScreenshotDescription } from "@/hooks/use-screenshot-blocks";
import { resolveScreenshotUrl } from "@/lib/s3/screenshot-url";
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

function ScreenshotBlockRender({ block, editor }: ScreenshotBlockRenderProps) {
  const blockId = block.props.screenshotBlockId;
  const readOnly = !editor.isEditable;
  const pageId = usePageId();
  const screenshotBlock = useScreenshotBlock(blockId || undefined);
  const uploadScreenshot = useUploadScreenshot();
  const updateAnnotation = useUpdateScreenshotAnnotation();
  const updateDescription = useUpdateScreenshotDescription();
  const [isAnnotating, setIsAnnotating] = useState(false);
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
      setIsAnnotating(true);
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
        imageUrl={resolveScreenshotUrl(screenshotBlock.imageUrl)}
        imageWidth={screenshotBlock.imageWidth}
        imageHeight={screenshotBlock.imageHeight}
        initialAnnotation={screenshotBlock.annotationJson}
        onDone={(annotation) => {
          updateAnnotation(screenshotBlock.id, annotation).catch(() => toast.error("Gagal menyimpan anotasi, silakan coba lagi."));
          setIsAnnotating(false);
        }}
        onCancel={() => setIsAnnotating(false)}
      />
    );
  }

  return (
    <div className="group relative my-4 w-full max-w-screenshot-breakout">
      <button
        type="button"
        onClick={() => setIsAnnotating(true)}
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
