"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Square, MoveUpRight, CircleDot, Type } from "lucide-react";
import type { Annotation, AnnotationShapeType } from "@/lib/types";
import { annotationStrokeWidth } from "./annotation-overlay";

export const TOOLS: { type: AnnotationShapeType; icon: typeof Square; label: string }[] = [
  { type: "marker", icon: CircleDot, label: "Nomor" },
  { type: "arrow", icon: MoveUpRight, label: "Panah" },
  { type: "box", icon: Square, label: "Kotak" },
  { type: "label", icon: Type, label: "Label" },
];

export const SWATCHES = [
  "oklch(0.680 0.190 25)",
  "oklch(0.820 0.160 80)",
  "oklch(0.943 0.141 125.3)",
  "oklch(0.780 0.130 230)",
  "oklch(0.940 0.010 250)",
];

/** 3 stroke-width presets (properties bar), relative to the image-proportional base from annotationStrokeWidth. */
export const STROKE_WIDTH_MULTIPLIERS = [0.6, 1, 1.8] as const;

/** Fraction of the image's width/height a marker-tool drag must travel before it commits to "badge + arrow", not just a plain click. */
const MARKER_DRAG_THRESHOLD = 0.015;

type DragSession =
  | { id: string; mode: "create-box"; originX: number; originY: number }
  | { id: string; mode: "create-arrow"; originX: number; originY: number }
  | { id: string; mode: "move"; originX: number; originY: number; originAnnX: number; originAnnY: number }
  | { id: string; mode: "marker-drag"; originX: number; originY: number; order: number; color: string; arrowId: string | null };

interface AnnotationEditorOverlayProps {
  annotations: Annotation[];
  imageWidth: number;
  imageHeight: number;
  activeTool: AnnotationShapeType | null;
  onActiveToolChange: (tool: AnnotationShapeType | null) => void;
  /** Color applied to newly created shapes — driven by the caller's properties bar, not owned here. */
  activeColor: string;
  /** Stroke width (image-pixel space) applied to newly created shapes — driven by the caller's properties bar. */
  activeStrokeWidth: number;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  onAnnotationsChange: (next: Annotation[]) => void;
  /** The image being annotated — rendered by the caller so this component doesn't own image-loading concerns, wrapped here in the same sized/relative container the interactive SVG overlays. */
  children: React.ReactNode;
}

/**
 * Interactive SVG overlay for creating/selecting/moving/deleting
 * annotations. Every intermediate frame of a create-drag or move-drag calls
 * `onAnnotationsChange` immediately (not just on release) — the caller is
 * expected to patch a remount-safe store synchronously, since BlockNote's
 * dev-mode NodeView remount lands well inside a normal drag gesture (see
 * docs/testing/annotation-box-shape-dot-fix.tdd.md, whose bug — a box frozen
 * at its 1x1 creation dot — is exactly what this per-frame update avoids).
 *
 * Purely the drawing surface — tool selection, color, and stroke width are
 * all controlled props, rendered by the caller (the annotation focus mode's
 * rail/properties bar, wireframe v2 §3.4), not by this component itself.
 */
export function AnnotationEditorOverlay({
  annotations,
  imageWidth,
  imageHeight,
  activeTool,
  onActiveToolChange,
  activeColor,
  activeStrokeWidth,
  selectedId,
  onSelectedIdChange,
  onAnnotationsChange,
  children,
}: AnnotationEditorOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  // Tracks the same data as the `annotations` prop, but updated the instant
  // *we* write (not only once the prop round-trips back from the parent's
  // store) — a drag gesture calls this several times per second and can't
  // wait a render cycle to see its own previous frame's write.
  const annotationsRef = useRef(annotations);
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  // onActiveToolChange is a prop and can change identity across renders;
  // the pointer-move/up listener below is registered once (empty deps), so
  // it reads this ref instead of closing over a possibly-stale callback.
  const onActiveToolChangeRef = useRef(onActiveToolChange);
  useEffect(() => {
    onActiveToolChangeRef.current = onActiveToolChange;
  }, [onActiveToolChange]);

  function commit(next: Annotation[]) {
    annotationsRef.current = next;
    onAnnotationsChange(next);
  }

  function pointFromClient(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return { x: round4(clamp01((clientX - rect.left) / rect.width)), y: round4(clamp01((clientY - rect.top) / rect.height)) };
  }

  function nextOrder() {
    return annotationsRef.current.reduce((max, a) => Math.max(max, a.order), 0) + 1;
  }

  function updateAnnotation(id: string, patch: Partial<Annotation>) {
    commit(annotationsRef.current.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function handleBackgroundPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget) return; // a shape already handled its own pointerdown
    const { x, y } = pointFromClient(e.clientX, e.clientY);

    if (!activeTool) {
      onSelectedIdChange(null);
      return;
    }

    const id = crypto.randomUUID();
    if (activeTool === "marker") {
      const order = nextOrder();
      commit([...annotationsRef.current, { id, type: "marker", order, color: activeColor, x, y, strokeWidth: activeStrokeWidth }]);
      onSelectedIdChange(id);
      // Stays in marker mode until pointerup: a drag beyond the threshold
      // grows an arrow from this badge to the release point (wireframe v2
      // §3.4's "klik = badge; drag = badge + panah"); a plain click leaves
      // just the badge.
      dragRef.current = { id, mode: "marker-drag", originX: x, originY: y, order, color: activeColor, arrowId: null };
    } else if (activeTool === "label") {
      commit([...annotationsRef.current, { id, type: "label", order: nextOrder(), color: activeColor, x, y, text: "", strokeWidth: activeStrokeWidth }]);
      onActiveToolChange(null);
      onSelectedIdChange(id);
    } else if (activeTool === "box") {
      commit([...annotationsRef.current, { id, type: "box", order: nextOrder(), color: activeColor, x, y, width: 0, height: 0, strokeWidth: activeStrokeWidth }]);
      dragRef.current = { id, mode: "create-box", originX: x, originY: y };
    } else if (activeTool === "arrow") {
      commit([...annotationsRef.current, { id, type: "arrow", order: nextOrder(), color: activeColor, x, y, x2: x, y2: y, strokeWidth: activeStrokeWidth }]);
      dragRef.current = { id, mode: "create-arrow", originX: x, originY: y };
    }
  }

  function handleShapePointerDown(e: ReactPointerEvent, annotation: Annotation) {
    e.stopPropagation();
    onSelectedIdChange(annotation.id);
    const point = pointFromClient(e.clientX, e.clientY);
    dragRef.current = { id: annotation.id, mode: "move", originX: point.x, originY: point.y, originAnnX: annotation.x, originAnnY: annotation.y };
  }

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const { x, y } = pointFromClient(e.clientX, e.clientY);

      if (drag.mode === "create-box") {
        updateAnnotation(drag.id, {
          x: Math.min(x, drag.originX),
          y: Math.min(y, drag.originY),
          width: round4(Math.abs(x - drag.originX)),
          height: round4(Math.abs(y - drag.originY)),
        });
      } else if (drag.mode === "create-arrow") {
        updateAnnotation(drag.id, { x2: x, y2: y });
      } else if (drag.mode === "marker-drag") {
        const dist = Math.hypot(x - drag.originX, y - drag.originY);
        if (dist < MARKER_DRAG_THRESHOLD) return;
        if (!drag.arrowId) {
          const arrowId = crypto.randomUUID();
          drag.arrowId = arrowId;
          commit([
            ...annotationsRef.current,
            { id: arrowId, type: "arrow", order: drag.order, color: drag.color, x: drag.originX, y: drag.originY, x2: x, y2: y },
          ]);
        } else {
          updateAnnotation(drag.arrowId, { x2: x, y2: y });
        }
      } else {
        const annotation = annotationsRef.current.find((a) => a.id === drag.id);
        if (!annotation) return;
        const dx = round4(x - drag.originX);
        const dy = round4(y - drag.originY);
        const patch: Partial<Annotation> = { x: round4(drag.originAnnX + dx), y: round4(drag.originAnnY + dy) };
        if (annotation.type === "arrow") {
          const shaftDx = round4((annotation.x2 ?? annotation.x) - annotation.x);
          const shaftDy = round4((annotation.y2 ?? annotation.y) - annotation.y);
          patch.x2 = round4((patch.x ?? 0) + shaftDx);
          patch.y2 = round4((patch.y ?? 0) + shaftDy);
        }
        updateAnnotation(drag.id, patch);
      }
    }
    function handleUp() {
      // A marker-tool click that never crossed the drag threshold leaves the
      // tool active for one more shot at picking up the "drag" — mirrors the
      // pre-existing plain-click behavior of returning to select mode only
      // once a badge is actually placed, which already happened on pointerdown.
      if (dragRef.current?.mode === "marker-drag") {
        // onActiveToolChange is stable (from props) and safe to call from
        // this effect-registered-once listener.
        onActiveToolChangeRef.current(null);
      }
      dragRef.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // dragRef/annotationsRef are refs (read fresh every call) — this listener
    // pair is intentionally registered once, not re-subscribed per keystroke/frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key !== "Delete" && e.key !== "Backspace") || !selectedId) return;
      if (document.activeElement instanceof HTMLInputElement) return;
      commit(annotationsRef.current.filter((a) => a.id !== selectedId));
      onSelectedIdChange(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const strokeWidth = activeStrokeWidth;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-background">
      {children}
      <svg
        ref={svgRef}
        data-testid="annotation-editor-canvas"
        viewBox={`0 0 ${imageWidth} ${imageHeight}`}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={handleBackgroundPointerDown}
      >
        <defs>
          {annotations
            .filter((a) => a.type === "arrow")
            .map((a) => (
              <marker key={a.id} id={`arrowhead-editor-${a.id}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill={a.color} />
              </marker>
            ))}
        </defs>
        {annotations.map((a) => (
          <EditableAnnotationShape
            key={a.id}
            annotation={a}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            strokeWidth={a.strokeWidth ?? strokeWidth ?? annotationStrokeWidth(imageWidth)}
            selected={selectedId === a.id}
            onPointerDown={(e) => handleShapePointerDown(e, a)}
            onTextChange={(text) => updateAnnotation(a.id, { text })}
          />
        ))}
      </svg>
    </div>
  );
}

function EditableAnnotationShape({
  annotation,
  imageWidth,
  imageHeight,
  strokeWidth,
  selected,
  onPointerDown,
  onTextChange,
}: {
  annotation: Annotation;
  imageWidth: number;
  imageHeight: number;
  strokeWidth: number;
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  onTextChange: (text: string) => void;
}) {
  const x = annotation.x * imageWidth;
  const y = annotation.y * imageHeight;
  const selectionColor = "oklch(0.780 0.130 230)";

  return (
    <g data-testid={`annotation-${annotation.id}`} data-selected={selected} onPointerDown={onPointerDown} className="cursor-move">
      {annotation.type === "box" && (
        <rect
          x={x}
          y={y}
          width={(annotation.width ?? 0) * imageWidth}
          height={(annotation.height ?? 0) * imageHeight}
          fill="transparent"
          stroke={selected ? selectionColor : annotation.color}
          strokeWidth={strokeWidth}
          strokeDasharray={selected ? "4 3" : undefined}
          rx={4}
        />
      )}
      {annotation.type === "arrow" && (
        <>
          <line
            x1={x}
            y1={y}
            x2={(annotation.x2 ?? annotation.x) * imageWidth}
            y2={(annotation.y2 ?? annotation.y) * imageHeight}
            stroke="transparent"
            strokeWidth={Math.max(strokeWidth * 4, 16)}
          />
          <line
            x1={x}
            y1={y}
            x2={(annotation.x2 ?? annotation.x) * imageWidth}
            y2={(annotation.y2 ?? annotation.y) * imageHeight}
            stroke={selected ? selectionColor : annotation.color}
            strokeWidth={strokeWidth}
            markerEnd={`url(#arrowhead-editor-${annotation.id})`}
          />
        </>
      )}
      {annotation.type === "marker" && (
        <>
          <circle cx={x} cy={y} r={strokeWidth * 4.5} fill={selected ? selectionColor : annotation.color} />
          <text x={x} y={y} fill="#ffffff" fontSize={strokeWidth * 4.5} fontWeight={700} textAnchor="middle" dominantBaseline="central">
            {annotation.order}
          </text>
        </>
      )}
      {annotation.type === "label" && (
        <>
          <text x={x} y={y} fill={selected ? selectionColor : annotation.color} fontSize={Math.max(12, imageWidth * 0.02)} fontWeight={600} dominantBaseline="hanging">
            {selected ? "" : annotation.text}
          </text>
          {selected && (
            <foreignObject x={x} y={y} width={Math.max(160, imageWidth * 0.25)} height={Math.max(28, imageWidth * 0.035)}>
              <input
                type="text"
                value={annotation.text ?? ""}
                onChange={(e) => onTextChange(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Tulis label…"
                className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-body-sm text-foreground outline-none"
              />
            </foreignObject>
          )}
        </>
      )}
    </g>
  );
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Keeps stored fractions clean and avoids binary-floating-point noise (e.g. 0.1 - 0.3 = -0.19999999999999998) leaking into persisted data. */
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
