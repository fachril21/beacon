"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { X, Undo2, Redo2, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAnnotationFocusBlockId, closeAnnotationFocus } from "@/lib/annotation-focus-store";
import { useActiveAnnotationTool, setActiveAnnotationTool } from "@/lib/annotation-tool-store";
import { useScreenshotBlock, useUpdateScreenshotAnnotations, usePatchScreenshotAnnotationsLocal, useUpdateScreenshotDescription } from "@/hooks/use-screenshot-blocks";
import { resolveScreenshotUrl } from "@/lib/s3/screenshot-url";
import { usePageId } from "./page-id-context";
import { AnnotationEditorOverlay, TOOLS, SWATCHES, STROKE_WIDTH_MULTIPLIERS } from "./annotation-editor-overlay";
import { annotationStrokeWidth } from "./annotation-overlay";
import type { Annotation } from "@/lib/types";

const UNDO_STACK_LIMIT = 50;

function objectLabel(a: Annotation): string {
  switch (a.type) {
    case "marker":
      return `Nomor ${a.order}`;
    case "box":
      return "Kotak";
    case "arrow":
      return "Panah";
    case "label":
      return a.text ? `Label: ${a.text}` : "Label (kosong)";
    default:
      return "Objek";
  }
}

/**
 * Full-screen focused annotation mode (wireframe v2 §3.4), opened from the
 * screenshot block's "Edit anotasi" pill. Mounted once, as a sibling of
 * BlockNoteView inside PageEditor — PageEditor itself never remounts (see
 * docs/testing/annotation-editor-flicker-mitigation.tdd.md), so this
 * component's own local state (undo/redo stack, selection, in-progress
 * color/tool choices) is structurally immune to the ~150-400ms dev-mode
 * NodeView remount that the screenshot block it was opened from goes
 * through — unlike that remounting block, this component doesn't need to
 * push everything into an external store to survive it. Only *which* block
 * is open (`annotation-focus-store`) and the active tool
 * (`annotation-tool-store`, shared with the pre-focus-mode inline overlay
 * this replaced) are external, because those must be readable from outside
 * this component's own lifecycle.
 */
export function AnnotationFocusMode() {
  const blockId = useAnnotationFocusBlockId();
  if (!blockId) return null;
  // Remount fresh per block id: resets undo history and local UI state
  // (selection, in-progress color/stroke choice) whenever a different
  // screenshot block is opened, which is the correct behavior for state
  // that's explicitly local to one editing session.
  return <AnnotationFocusModeContent key={blockId} blockId={blockId} />;
}

function AnnotationFocusModeContent({ blockId }: { blockId: string }) {
  const pageId = usePageId();
  const screenshotBlock = useScreenshotBlock(blockId, pageId);
  const [activeTool, setActiveTool] = useActiveAnnotationTool(blockId);
  const updateAnnotations = useUpdateScreenshotAnnotations();
  const patchAnnotationsLocal = usePatchScreenshotAnnotationsLocal();
  const updateDescription = useUpdateScreenshotDescription();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState(SWATCHES[2]);
  const [strokeMultiplierIndex, setStrokeMultiplierIndex] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [description, setDescription] = useState(screenshotBlock?.description ?? "");

  const undoStackRef = useRef<Annotation[][]>([]);
  const redoStackRef = useRef<Annotation[][]>([]);
  // Reactive mirrors of the two stacks' lengths — the stacks themselves stay
  // in refs (no re-render on every push), but the Undo/Redo buttons' disabled
  // state must actually re-render, and refs can't be read during render.
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const annotationsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descriptionSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The snapshot annotations were in when this session opened — "Batal" reverts to it.
  const openedAtRef = useRef<Annotation[] | null>(null);

  useEffect(() => {
    if (openedAtRef.current === null && screenshotBlock) {
      openedAtRef.current = screenshotBlock.annotations;
    }
    // Deliberately runs only once per mount (per block id, via the parent's
    // `key`) — this is a one-time snapshot of whatever was loaded first, not
    // something that should re-capture on every annotations change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (annotationsSaveRef.current) clearTimeout(annotationsSaveRef.current);
      if (descriptionSaveRef.current) clearTimeout(descriptionSaveRef.current);
    };
  }, []);

  const annotations = screenshotBlock?.annotations ?? [];

  function persist(next: Annotation[]) {
    if (!screenshotBlock) return;
    patchAnnotationsLocal(screenshotBlock.id, next);
    setIsSaving(true);
    if (annotationsSaveRef.current) clearTimeout(annotationsSaveRef.current);
    annotationsSaveRef.current = setTimeout(() => {
      updateAnnotations(screenshotBlock.id, next)
        .catch(() => toast.error("Gagal menyimpan anotasi, silakan coba lagi."))
        .finally(() => setIsSaving(false));
    }, 500);
  }

  function handleAnnotationsChange(next: Annotation[]) {
    undoStackRef.current = [...undoStackRef.current, annotations].slice(-UNDO_STACK_LIMIT);
    redoStackRef.current = [];
    setUndoCount(undoStackRef.current.length);
    setRedoCount(0);
    persist(next);
  }

  function handleUndo() {
    const prev = undoStackRef.current.at(-1);
    if (!prev) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, annotations].slice(-UNDO_STACK_LIMIT);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    setSelectedId(null);
    persist(prev);
  }

  function handleRedo() {
    const next = redoStackRef.current.at(-1);
    if (!next) return;
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, annotations].slice(-UNDO_STACK_LIMIT);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    setSelectedId(null);
    persist(next);
  }

  function handleDeleteSelected() {
    if (!selectedId) return;
    handleAnnotationsChange(annotations.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    if (!screenshotBlock) return;
    if (descriptionSaveRef.current) clearTimeout(descriptionSaveRef.current);
    descriptionSaveRef.current = setTimeout(() => {
      updateDescription(screenshotBlock.id, value).catch(() => toast.error("Gagal menyimpan deskripsi, silakan coba lagi."));
    }, 800);
  }

  function handleClose(keepChanges: boolean) {
    if (!keepChanges && openedAtRef.current && screenshotBlock) {
      persist(openedAtRef.current);
    }
    setActiveAnnotationTool(blockId, null);
    closeAnnotationFocus();
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (isMod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations]);

  if (!screenshotBlock) return null;

  const strokeWidth = round1(annotationStrokeWidth(screenshotBlock.imageWidth) * STROKE_WIDTH_MULTIPLIERS[strokeMultiplierIndex]);
  const nextMarkerNumber = annotations.reduce((max, a) => Math.max(max, a.order), 0) + 1;

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose(true)}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-full w-full max-w-none sm:max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0"
      >
        {/* Top bar — 48px */}
        <div className="flex h-topbar shrink-0 items-center gap-3 border-b border-border px-4">
          <Button variant="ghost" size="icon-sm" aria-label="Tutup mode anotasi" onClick={() => handleClose(true)}>
            <X className="size-4" />
          </Button>
          <span className="text-body-sm font-semibold text-foreground">Anotasi</span>
          <span className="text-caption text-muted-foreground">{isSaving ? "Menyimpan…" : "Tersimpan"}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={() => handleClose(true)}>
              Selesai
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Left tool rail — 64px */}
          <div className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-border bg-sidebar py-3">
            {TOOLS.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                type="button"
                aria-label={label}
                aria-pressed={activeTool === type}
                onClick={() => setActiveTool(activeTool === type ? null : type)}
                className={cn(
                  "flex size-12 flex-col items-center justify-center gap-0.5 rounded-md text-caption",
                  activeTool === type ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
            <div className="my-1 h-px w-8 bg-sidebar-border" />
            <button
              type="button"
              aria-label="Urungkan"
              disabled={undoCount === 0}
              onClick={handleUndo}
              className="flex size-10 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-30"
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Ulangi"
              disabled={redoCount === 0}
              onClick={handleRedo}
              className="flex size-10 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-30"
            >
              <Redo2 className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Hapus objek"
              disabled={!selectedId}
              onClick={handleDeleteSelected}
              className="flex size-10 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-30"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          {/* Canvas area */}
          <div className="relative flex min-w-0 flex-1 flex-col items-center overflow-auto bg-muted p-8">
            {/* Floating properties bar */}
            <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-popover px-3 py-2 shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]">
              <div className="flex items-center gap-1">
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Warna ${color}`}
                    aria-pressed={activeColor === color}
                    onClick={() => setActiveColor(color)}
                    className={cn("size-5 rounded-full border-2", activeColor === color ? "border-foreground" : "border-transparent")}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1">
                {STROKE_WIDTH_MULTIPLIERS.map((multiplier, index) => (
                  <button
                    key={multiplier}
                    type="button"
                    aria-label={["Garis tipis", "Garis sedang", "Garis tebal"][index]}
                    aria-pressed={strokeMultiplierIndex === index}
                    onClick={() => setStrokeMultiplierIndex(index)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-sm",
                      strokeMultiplierIndex === index ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <span
                      className="w-3.5 rounded-full bg-foreground"
                      style={{ height: Math.round(2 + index * 1.5) }}
                    />
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-border" />
              <span className="text-caption text-muted-foreground">Nomor berikutnya: {nextMarkerNumber}</span>
            </div>

            <div className="w-full max-w-(--width-screenshot-breakout)">
              <AnnotationEditorOverlay
                annotations={annotations}
                imageWidth={screenshotBlock.imageWidth}
                imageHeight={screenshotBlock.imageHeight}
                activeTool={activeTool}
                onActiveToolChange={setActiveTool}
                activeColor={activeColor}
                activeStrokeWidth={strokeWidth}
                selectedId={selectedId}
                onSelectedIdChange={setSelectedId}
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
            </div>

            <p className="mt-4 text-caption text-muted-foreground">
              <kbd className="rounded border border-border px-1">Del</kbd> hapus ·{" "}
              <kbd className="rounded border border-border px-1">⌘Z</kbd> urungkan ·{" "}
              <kbd className="rounded border border-border px-1">Esc</kbd> keluar
            </p>
          </div>

          {/* Right panel — 320px */}
          <div className="flex w-right-panel shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-4">
            <div>
              <p className="mb-2 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">Daftar objek</p>
              {annotations.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">Belum ada objek anotasi.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {annotations.map((a) => (
                    <li key={a.id}>
                      <div
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-body-sm",
                          selectedId === a.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
                        )}
                      >
                        <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setSelectedId(a.id)}>
                          {objectLabel(a)}
                        </button>
                        <button
                          type="button"
                          aria-label={`Hapus ${objectLabel(a)}`}
                          onClick={() => {
                            handleAnnotationsChange(annotations.filter((x) => x.id !== a.id));
                            if (selectedId === a.id) setSelectedId(null);
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label htmlFor="step-description" className="mb-2 block text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                Deskripsi langkah
              </label>
              <Textarea
                id="step-description"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Jelaskan langkah ini…"
                className="min-h-24"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
