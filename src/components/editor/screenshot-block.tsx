"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { createReactBlockSpec, type ReactCustomBlockRenderProps } from "@blocknote/react";
import { useScreenshotBlockLookup, useUploadScreenshot, useUpdateScreenshotDescription } from "@/hooks/use-screenshot-blocks";
import { resolveScreenshotUrl } from "@/lib/s3/screenshot-url";
import { screenshotUploadErrorMessage } from "@/lib/s3/upload-error";
import { openAnnotationFocus } from "@/lib/annotation-focus-store";
import { usePageId } from "./page-id-context";
import { ScreenshotUploadPrompt } from "./screenshot-upload-prompt";
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
  const { block: screenshotBlock, status: lookupStatus, retry } = useScreenshotBlockLookup(blockId || undefined, pageId);
  const uploadScreenshot = useUploadScreenshot();
  const updateDescription = useUpdateScreenshotDescription();
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
    } catch (error) {
      toast.error(screenshotUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  // The upload prompt is only for a block that has no image yet. A block that
  // already references an id must never fall back to it just because its row
  // hasn't arrived (or couldn't be read) — that invites overwriting a real image.
  if (!blockId) {
    return readOnly ? null : <ScreenshotUploadPrompt onUpload={(file, w, h) => void handleUpload(file, w, h)} isUploading={isUploading} />;
  }

  if (!screenshotBlock) {
    if (readOnly) return null;
    if (lookupStatus === "missing" || lookupStatus === "error") {
      return (
        <div className="my-4 flex w-full max-w-(--width-screenshot-breakout) items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-body-sm text-muted-foreground">
          <span>{lookupStatus === "error" ? "Gagal memuat gambar ini." : "Gambar ini belum bisa ditemukan."}</span>
          <button type="button" onClick={retry} className="rounded-md border border-border px-2.5 py-1 text-popover-foreground hover:bg-accent">
            Muat ulang
          </button>
        </div>
      );
    }
    return (
      <div
        role="status"
        aria-label="Memuat gambar"
        className="my-4 h-48 w-full max-w-(--width-screenshot-breakout) animate-pulse rounded-lg border border-border bg-muted"
      />
    );
  }

  if (readOnly) {
    return (
      <div className="my-4 w-full max-w-(--width-screenshot-breakout)">
        <div className="relative overflow-hidden rounded-lg border border-border bg-background">
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

  return (
    <div className="group relative my-4 w-full max-w-(--width-screenshot-breakout)">
      <button
        type="button"
        onClick={() => openAnnotationFocus(screenshotBlock.id)}
        className="relative block w-full overflow-hidden rounded-lg border border-border bg-background text-left"
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
      </button>
      {/* Corner controls float above the frame, not inside the image button — CommentThreadPanel needs its own click target, which a nested <button> can't give it (invalid HTML). */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
        <CommentThreadPanel blockId={screenshotBlock.id} className="bg-popover shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]" />
        <button
          type="button"
          onClick={() => openAnnotationFocus(screenshotBlock.id)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-popover px-2.5 py-1.5 text-body-sm text-popover-foreground shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)] hover:bg-accent"
        >
          <Pencil className="size-3.5" />
          Edit anotasi
        </button>
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
