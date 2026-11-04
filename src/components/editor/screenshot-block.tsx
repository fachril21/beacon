"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import { AlignCenter, AlignLeft, AlignRight, MoveHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createReactBlockSpec, type ReactCustomBlockRenderProps } from "@blocknote/react";
import { useScreenshotBlock, useUploadScreenshot, useUpdateScreenshotDescription } from "@/hooks/use-screenshot-blocks";
import { resolveScreenshotUrl } from "@/lib/s3/screenshot-url";
import { screenshotUploadErrorMessage } from "@/lib/s3/upload-error";
import { openAnnotationFocus } from "@/lib/annotation-focus-store";
import { cn } from "@/lib/utils";
import { usePageId } from "./page-id-context";
import { ScreenshotUploadPrompt } from "./screenshot-upload-prompt";
import { AnnotationOverlay } from "./annotation-overlay";
import { CommentThreadPanel } from "./comment-thread-panel";
import { Textarea } from "@/components/ui/textarea";

/** Smallest / largest display width, as a percentage of the row. */
const MIN_WIDTH = 20;
const MAX_WIDTH = 100;
const WIDTH_STEP = 5;

const ALIGNMENTS = [
  { value: "left", label: "Rata kiri", icon: AlignLeft },
  { value: "center", label: "Rata tengah", icon: AlignCenter },
  { value: "right", label: "Rata kanan", icon: AlignRight },
] as const;

type Alignment = (typeof ALIGNMENTS)[number]["value"];

export const screenshotBlockConfig = {
  type: "screenshot",
  propSchema: {
    screenshotBlockId: { default: "" },
    /**
     * Display width as a percentage of the row. Stored in the block props
     * (not the screenshot_blocks row) so it travels with the page content —
     * including published snapshots and version history.
     */
    displayWidth: { default: MAX_WIDTH },
    /** Alignment of the image inside its row. Same persistence path as displayWidth. */
    alignment: { default: "left", values: ["left", "center", "right"] as const },
  },
  content: "none",
} as const;

type ScreenshotBlockRenderProps = ReactCustomBlockRenderProps<typeof screenshotBlockConfig>;

function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return MAX_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
}

function normalizeAlignment(value: string): Alignment {
  return value === "center" || value === "right" ? value : "left";
}

function alignmentClass(alignment: Alignment): string {
  if (alignment === "center") return "justify-center";
  if (alignment === "right") return "justify-end";
  return "justify-start";
}

function captionAlignmentClass(alignment: Alignment): string {
  if (alignment === "center") return "text-center";
  if (alignment === "right") return "text-right";
  return "text-left";
}

function ScreenshotBlockRender({ block, editor }: ScreenshotBlockRenderProps) {
  const blockId = block.props.screenshotBlockId;
  const readOnly = !editor.isEditable;
  const pageId = usePageId();
  const screenshotBlock = useScreenshotBlock(blockId || undefined, pageId);
  const uploadScreenshot = useUploadScreenshot();
  const updateDescription = useUpdateScreenshotDescription();
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState(screenshotBlock?.description ?? "");
  const descriptionSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While the user drags (or slides) the width, the preview lives locally so
  // BlockNote doesn't re-render the whole document on every pointer frame.
  // The committed value goes into the block props on release — that keeps the
  // resize in the page content, where publishing and version history read it.
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    containerWidth: number;
    latestWidth: number;
  } | null>(null);

  const width = clampWidth(block.props.displayWidth);
  const displayWidth = previewWidth ?? width;
  const alignment = normalizeAlignment(block.props.alignment);

  useEffect(() => {
    return () => {
      if (descriptionSaveRef.current) clearTimeout(descriptionSaveRef.current);
    };
  }, []);

  function commitWidth(nextWidth: number) {
    const next = clampWidth(nextWidth);
    setPreviewWidth(null);
    if (next === width) return;
    editor.updateBlock(block, { props: { displayWidth: next } });
  }

  function handleWidthChange(value: number) {
    setPreviewWidth(clampWidth(value));
  }

  function handleAlignmentChange(next: Alignment) {
    editor.updateBlock(block, { props: { alignment: next } });
  }

  // The handle sits on the edge that would otherwise move: the right edge for
  // left/center images, the left edge for right-aligned images. Center images
  // grow symmetrically, so a drag of 1px adds 2px of width.
  const handleSide = alignment === "right" ? "left" : "right";

  function handleResizePointerDown(event: PointerEvent<HTMLButtonElement>) {
    const container = frameRef.current;
    if (!container) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startWidth: displayWidth,
      containerWidth: container.clientWidth || 1,
      latestWidth: displayWidth,
    };
    setPreviewWidth(displayWidth);
  }

  function handleResizePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    const direction = handleSide === "left" ? -1 : 1;
    const multiplier = alignment === "center" ? 2 : 1;
    const next = clampWidth(drag.startWidth + ((delta * direction * multiplier) / drag.containerWidth) * 100);
    drag.latestWidth = next;
    setPreviewWidth(next);
  }

  function handleResizePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commitWidth(drag.latestWidth);
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = displayWidth - WIDTH_STEP;
    else if (event.key === "ArrowRight") next = displayWidth + WIDTH_STEP;
    else if (event.key === "Home") next = MIN_WIDTH;
    else if (event.key === "End") next = MAX_WIDTH;
    if (next === null) return;
    event.preventDefault();
    commitWidth(next);
  }

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

  if (!blockId || !screenshotBlock) {
    return readOnly ? null : <ScreenshotUploadPrompt onUpload={(file, w, h) => void handleUpload(file, w, h)} isUploading={isUploading} />;
  }

  if (readOnly) {
    return (
      <div
        className={cn("my-4 flex w-full max-w-(--width-screenshot-breakout)", alignmentClass(alignment))}
        data-image-alignment={alignment}
        data-image-width={displayWidth}
      >
        <figure
          className={cn("relative m-0 min-w-0", captionAlignmentClass(alignment))}
          style={{ width: `${displayWidth}%` }}
        >
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
        </figure>
      </div>
    );
  }

  return (
    <div
      className="group my-4 w-full max-w-(--width-screenshot-breakout)"
      data-image-alignment={alignment}
      data-image-width={displayWidth}
    >
      <div className={cn("flex w-full", alignmentClass(alignment))}>
        <figure
          ref={frameRef}
          className={cn("relative m-0 min-w-0", captionAlignmentClass(alignment))}
          style={{ width: `${displayWidth}%` }}
        >
          <div className="relative">
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
            <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
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
            <button
              type="button"
              role="slider"
              aria-label="Tarik untuk mengubah ukuran gambar"
              aria-valuemin={MIN_WIDTH}
              aria-valuemax={MAX_WIDTH}
              aria-valuenow={displayWidth}
              aria-valuetext={`${displayWidth}%`}
              title="Tarik untuk mengubah ukuran"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              onKeyDown={handleResizeKeyDown}
              className={cn(
                "beacon-image-resize absolute bottom-2 z-10 flex size-6 touch-none cursor-ew-resize items-center justify-center rounded-md border border-border bg-popover/95 text-muted-foreground shadow-sm transition-colors hover:text-foreground",
                handleSide === "left" ? "left-2" : "right-2",
              )}
            >
              <MoveHorizontal className="size-3.5" aria-hidden />
            </button>
          </div>
          <Textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Jelaskan langkah ini…"
            className="mt-2 min-h-16 border-none bg-transparent px-0 text-left text-body-sm text-muted-foreground focus-visible:ring-0"
          />
        </figure>
      </div>

      {/* Authoring-only controls (never rendered on the public reading surface). */}
      <div
        className="beacon-image-controls mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-card px-2.5 py-1.5"
        contentEditable={false}
      >
        <label className="flex min-w-[9rem] flex-1 items-center gap-2 text-caption text-muted-foreground">
          <span className="shrink-0">Ukuran</span>
          <input
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={WIDTH_STEP}
            value={displayWidth}
            aria-label="Ukuran gambar (persen)"
            onChange={(event) => handleWidthChange(Number(event.target.value))}
            onPointerUp={(event) => commitWidth(Number(event.currentTarget.value))}
            onKeyUp={(event) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
                commitWidth(Number(event.currentTarget.value));
              }
            }}
            onBlur={(event) => commitWidth(Number(event.currentTarget.value))}
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
          />
          <span className="w-9 shrink-0 text-right tabular-nums text-foreground">{displayWidth}%</span>
        </label>
        <div className="h-4 w-px bg-border" aria-hidden />
        <div role="group" aria-label="Perataan gambar" className="flex items-center gap-0.5">
          {ALIGNMENTS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={alignment === value}
              onClick={() => handleAlignmentChange(value)}
              className={cn(
                "flex size-7 items-center justify-center rounded-sm transition-colors",
                alignment === value
                  ? "bg-primary-muted text-primary-muted-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const screenshotBlockSpec = createReactBlockSpec(screenshotBlockConfig, {
  render: ScreenshotBlockRender,
})();
