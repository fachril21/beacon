"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from "fabric";
import { Square, MoveUpRight, CircleDot, Type, EyeOff, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAnnotationCanvasSize } from "@/lib/annotation-canvas-size";
import {
  getAnnotationDraft,
  setAnnotationDraft,
  clearAnnotationDraft,
  getAnnotationToolState,
  setAnnotationToolState,
  clearAnnotationToolState,
} from "@/lib/annotation-draft-store";
import type { AnnotationJson, AnnotationToolType } from "@/lib/types";

const TOOLS: { type: AnnotationToolType; icon: typeof Square; label: string }[] = [
  { type: "box", icon: Square, label: "Kotak" },
  { type: "arrow", icon: MoveUpRight, label: "Panah" },
  { type: "marker", icon: CircleDot, label: "Penanda Bernomor" },
  { type: "label", icon: Type, label: "Label Teks" },
  { type: "blur", icon: EyeOff, label: "Blur / Redaksi" },
];

const SWATCHES = [
  { name: "destructive", value: "oklch(0.680 0.190 25)" },
  { name: "warning", value: "oklch(0.820 0.160 80)" },
  { name: "primary", value: "oklch(0.943 0.141 125.3)" },
  { name: "info", value: "oklch(0.780 0.130 230)" },
  { name: "foreground", value: "oklch(0.940 0.010 250)" },
];

interface AnnotationCanvasProps {
  /** The screenshot block's own stable id — the draft store's key, not the block's screenshotBlockId prop. */
  blockId: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  initialAnnotation: AnnotationJson | null;
  onDone: (annotation: AnnotationJson) => void;
  onCancel: () => void;
}

export function AnnotationCanvas({ blockId, imageUrl, imageWidth, imageHeight, initialAnnotation, onDone, onCancel }: AnnotationCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  // A draft (unsaved edits from a prior mount of this same block, wiped out
  // by the remount itself) takes priority over the last explicitly-saved
  // annotation — see annotation-draft-store.ts.
  const draftAnnotation = getAnnotationDraft(blockId);
  // Same remount-survival problem as the drawn shapes: activeTool/activeColor
  // are local state too, so without this a mid-session remount silently
  // deselects the tool the user just picked, and the next canvas click does
  // nothing (handleMouseDown's `if (!tool) return`).
  const draftToolState = getAnnotationToolState(blockId);
  const [activeTool, setActiveTool] = useState<AnnotationToolType | null>(draftToolState?.activeTool ?? null);
  const [activeColor, setActiveColor] = useState(draftToolState?.activeColor ?? SWATCHES[2].value);
  const [nextMarkerNumber, setNextMarkerNumber] = useState(draftAnnotation?.nextMarkerNumber ?? initialAnnotation?.nextMarkerNumber ?? 1);
  const [hasSelection, setHasSelection] = useState(false);

  const { scale, width: displayWidth, height: displayHeight } = getAnnotationCanvasSize(imageWidth, imageHeight);

  const activeToolRef = useRef(activeTool);
  const activeColorRef = useRef(activeColor);
  const nextMarkerRef = useRef(nextMarkerNumber);
  useEffect(() => {
    activeToolRef.current = activeTool;
    activeColorRef.current = activeColor;
    nextMarkerRef.current = nextMarkerNumber;
    // Every activeTool/activeColor change (button click, or the
    // auto-deselect after placing a label/shape) gets mirrored here, so
    // whichever one triggered it doesn't matter — the store always reflects
    // the latest selection.
    setAnnotationToolState(blockId, { activeTool, activeColor });
  }, [activeTool, activeColor, nextMarkerNumber, blockId]);

  const saveDraft = useCallback(
    (canvas: fabric.Canvas, nextMarker: number) => {
      const json = canvas.toJSON();
      const objects = (json.objects as Record<string, unknown>[]).filter((obj) => obj.type !== "Image");
      setAnnotationDraft(blockId, { version: "7.0", objects, nextMarkerNumber: nextMarker });
    },
    [blockId],
  );

  // Init canvas once. Fabric takes ownership of the <canvas> DOM node it's
  // given and physically detaches it on dispose() (confirmed via its
  // cleanupDOM -> Node.removeChild call) — a JSX-managed ref can't survive
  // that, since React 19 dev-mode Strict Mode mounts every new subtree
  // twice (mount -> cleanup -> mount) and the second mount would reuse the
  // now-detached node. Creating the <canvas> element imperatively here, one
  // fresh node per effect run, gives Fabric something it can safely own and
  // destroy on each of those runs.
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const canvasEl = document.createElement("canvas");
    canvasContainerRef.current.appendChild(canvasEl);
    let isDisposed = false;
    const canvas = new fabric.Canvas(canvasEl, {
      width: displayWidth,
      height: displayHeight,
      backgroundColor: "transparent",
      selection: true,
    });
    fabricRef.current = canvas;

    async function loadCanvas() {
      let img: fabric.FabricImage;
      try {
        img = await fabric.FabricImage.fromURL(imageUrl, { crossOrigin: null });
      } catch (error) {
        console.error("Gagal memuat gambar tangkapan layar:", error);
        return;
      }
      if (isDisposed) return;
      img.set({ selectable: false, evented: false, scaleX: scale, scaleY: scale, left: 0, top: 0, originX: "left", originY: "top" });

      const objectsToLoad = draftAnnotation?.objects?.length ? draftAnnotation.objects : initialAnnotation?.objects;
      if (objectsToLoad?.length) {
        await canvas.loadFromJSON({ objects: objectsToLoad });
      }
      if (isDisposed) return;
      canvas.add(img);
      canvas.sendObjectToBack(img);
      canvas.renderAll();
    }
    void loadCanvas();

    function updateSelectionState() {
      setHasSelection(canvas.getActiveObjects().length > 0);
    }
    canvas.on("selection:created", updateSelectionState);
    canvas.on("selection:updated", updateSelectionState);
    canvas.on("selection:cleared", updateSelectionState);

    // Persist every meaningful edit outside the component tree so it
    // survives this NodeView being torn down and recreated mid-session.
    function persistDraft() {
      saveDraft(canvas, nextMarkerRef.current);
    }
    canvas.on("object:added", persistDraft);
    canvas.on("object:removed", persistDraft);
    canvas.on("object:modified", persistDraft);

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && !(document.activeElement instanceof HTMLTextAreaElement)) {
        const active = canvas.getActiveObjects();
        const editingText = canvas.getActiveObject() instanceof fabric.IText && (canvas.getActiveObject() as fabric.IText).isEditing;
        if (active.length > 0 && !editingText) {
          active.forEach((obj) => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      isDisposed = true;
      window.removeEventListener("keydown", handleKeyDown);
      canvas.dispose();
      canvasEl.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drawing interactions.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    let isDrawing = false;
    let origin = { x: 0, y: 0 };
    let shape: fabric.FabricObject | null = null;

    function handleMouseDown(opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) {
      const tool = activeToolRef.current;
      if (!tool || !canvas) return;
      const pointer = canvas.getScenePoint(opt.e);
      origin = { x: pointer.x, y: pointer.y };
      const color = activeColorRef.current;

      if (tool === "box") {
        shape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 1,
          height: 1,
          fill: "transparent",
          stroke: color,
          strokeWidth: 3,
          rx: 4,
          ry: 4,
          originX: "left",
          originY: "top",
        });
        canvas.add(shape);
        isDrawing = true;
      } else if (tool === "blur") {
        shape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 1,
          height: 1,
          fill: "rgba(20,27,36,0.92)",
          stroke: "transparent",
          originX: "left",
          originY: "top",
        });
        canvas.add(shape);
        isDrawing = true;
      } else if (tool === "arrow") {
        shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], { stroke: color, strokeWidth: 4 });
        canvas.add(shape);
        isDrawing = true;
      } else if (tool === "marker") {
        const number = nextMarkerRef.current;
        const circle = new fabric.Circle({ radius: 14, fill: color, originX: "center", originY: "center" });
        const text = new fabric.FabricText(String(number), {
          fontSize: 14,
          fontWeight: "700",
          fill: "#141B24",
          originX: "center",
          originY: "center",
        });
        const group = new fabric.Group([circle, text], {
          left: pointer.x - 14,
          top: pointer.y - 14,
          originX: "left",
          originY: "top",
        });
        // Bump the ref before adding the shape: canvas.add() synchronously
        // fires "object:added", whose persistDraft() reads nextMarkerRef —
        // it needs to already see the post-increment value, since the
        // setNextMarkerNumber below won't reach the ref until the next
        // render's sync effect runs.
        const next = number + 1;
        nextMarkerRef.current = next;
        canvas.add(group);
        canvas.renderAll();
        setNextMarkerNumber(next);
      } else if (tool === "label") {
        const text = new fabric.IText("Label", {
          left: pointer.x,
          top: pointer.y,
          fill: color,
          fontSize: 16,
          fontWeight: "600",
          originX: "left",
          originY: "top",
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        setActiveTool(null);
      }
    }

    function handleMouseMove(opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) {
      if (!isDrawing || !shape || !canvas) return;
      const pointer = canvas.getScenePoint(opt.e);
      if (shape instanceof fabric.Line) {
        shape.set({ x2: pointer.x, y2: pointer.y });
      } else {
        shape.set({
          left: Math.min(origin.x, pointer.x),
          top: Math.min(origin.y, pointer.y),
          width: Math.abs(pointer.x - origin.x),
          height: Math.abs(pointer.y - origin.y),
        });
      }
      canvas.renderAll();
    }

    function handleMouseUp() {
      if (!isDrawing || !shape || !canvas) return;
      isDrawing = false;
      if (shape instanceof fabric.Line) {
        const x1 = shape.x1 ?? 0;
        const y1 = shape.y1 ?? 0;
        const x2 = shape.x2 ?? 0;
        const y2 = shape.y2 ?? 0;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowHead = new fabric.Triangle({
          left: x2,
          top: y2,
          originX: "center",
          originY: "center",
          width: 14,
          height: 16,
          fill: shape.stroke as string,
          angle: (angle * 180) / Math.PI + 90,
        });
        canvas.remove(shape);
        const line = new fabric.Line([x1, y1, x2, y2], { stroke: shape.stroke as string, strokeWidth: 4 });
        const group = new fabric.Group([line, arrowHead], { originX: "left", originY: "top" });
        canvas.add(group);
      }
      shape = null;
      canvas.renderAll();
      setActiveTool(null);
    }

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    canvas.selection = activeTool === null;
    canvas.forEachObject((obj) => obj.set({ selectable: activeTool === null, evented: activeTool === null }));
    canvas.defaultCursor = activeTool ? "crosshair" : "default";

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [activeTool]);

  const handleDone = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = canvas.toJSON();
    const objects = (json.objects as Record<string, unknown>[]).filter((obj) => obj.type !== "Image");
    onDone({ version: "7.0", objects, nextMarkerNumber });
    clearAnnotationDraft(blockId);
    clearAnnotationToolState(blockId);
  }, [onDone, nextMarkerNumber, blockId]);

  const handleCancel = useCallback(() => {
    clearAnnotationDraft(blockId);
    clearAnnotationToolState(blockId);
    onCancel();
  }, [onCancel, blockId]);

  const handleDeleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  }, []);

  return (
    <div className="my-4 flex w-full max-w-screenshot-breakout overflow-hidden rounded-xl border border-border">
      <div className="flex w-16 shrink-0 flex-col items-center gap-2 bg-sidebar py-3">
        {TOOLS.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => setActiveTool(activeTool === type ? null : type)}
            className={cn(
              "relative flex size-12 items-center justify-center rounded-md text-muted-foreground hover:bg-accent",
              activeTool === type && "bg-primary text-primary-foreground hover:bg-primary",
              type === "blur" && "ring-1 ring-inset ring-warning",
            )}
          >
            <Icon className="size-5" />
            {type === "marker" && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary-muted text-[10px] font-semibold text-primary-muted-foreground">
                {nextMarkerNumber}
              </span>
            )}
          </button>
        ))}
        {hasSelection && (
          <button
            type="button"
            aria-label="Hapus objek terpilih"
            title="Hapus objek terpilih"
            onClick={handleDeleteSelected}
            className="mt-2 flex size-10 items-center justify-center rounded-md text-destructive hover:bg-accent"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-popover px-4 py-2.5">
          {activeTool ? (
            <div className="flex items-center gap-2">
              <span className="text-caption text-muted-foreground">Warna:</span>
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch.name}
                  type="button"
                  aria-label={swatch.name}
                  onClick={() => setActiveColor(swatch.value)}
                  className={cn(
                    "size-5 rounded-full border-2",
                    activeColor === swatch.value ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: swatch.value }}
                />
              ))}
            </div>
          ) : (
            <span className="text-caption text-muted-foreground">Pilih alat untuk mulai memberi anotasi</span>
          )}
          <button
            type="button"
            onClick={handleDone}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-body-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <Check className="size-3.5" />
            Selesai memberi anotasi
          </button>
        </div>
        <div className="flex items-center justify-center overflow-auto p-4">
          <div ref={canvasContainerRef} />
        </div>
        <button type="button" onClick={handleCancel} className="self-end px-4 pb-3 text-caption text-muted-foreground hover:text-foreground">
          Batal
        </button>
      </div>
    </div>
  );
}
