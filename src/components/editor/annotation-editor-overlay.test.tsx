import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnnotationEditorOverlay } from "./annotation-editor-overlay";
import type { Annotation, AnnotationShapeType } from "@/lib/types";

// jsdom never computes real layout, so the SVG's bounding rect is all zeros
// by default. Stub it to a fixed, known rect matching imageWidth/imageHeight
// 1:1 so pointer client coordinates translate to predictable fractions.
beforeEach(() => {
  Object.defineProperty(SVGSVGElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  });
});

// A stateful wrapper: mirrors how the real screenshot-block.tsx parent wires
// this component (annotations flow back in through props once the caller's
// store patches), so DOM assertions about "what got created" work the same
// way they would in the app, not just spy-call assertions.
function renderOverlay(overrides: {
  annotations?: Annotation[];
  activeTool?: AnnotationShapeType | null;
  imageWidth?: number;
  imageHeight?: number;
} = {}) {
  const onAnnotationsChange = vi.fn();
  const onActiveToolChange = vi.fn();

  function Harness() {
    const [annotations, setAnnotations] = useState<Annotation[]>(overrides.annotations ?? []);
    const [activeTool, setActiveTool] = useState<AnnotationShapeType | null>(overrides.activeTool ?? null);
    return (
      <AnnotationEditorOverlay
        annotations={annotations}
        imageWidth={overrides.imageWidth ?? 800}
        imageHeight={overrides.imageHeight ?? 600}
        activeTool={activeTool}
        onActiveToolChange={(tool) => {
          onActiveToolChange(tool);
          setActiveTool(tool);
        }}
        onAnnotationsChange={(next) => {
          onAnnotationsChange(next);
          setAnnotations(next);
        }}
      />
    );
  }

  const utils = render(<Harness />);
  const canvas = utils.container.querySelector('[data-testid="annotation-editor-canvas"]') as SVGSVGElement;
  return { ...utils, canvas, onAnnotationsChange, onActiveToolChange };
}

describe("AnnotationEditorOverlay toolbar", () => {
  it("renders a button for each of the four required annotation tools", () => {
    renderOverlay();
    expect(screen.getByRole("button", { name: /Penanda Bernomor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Panah/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kotak/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Label Teks/i })).toBeInTheDocument();
  });

  it("selects a tool when its button is clicked", async () => {
    const { onActiveToolChange } = renderOverlay();
    fireEvent.click(screen.getByRole("button", { name: /Kotak/i }));
    expect(onActiveToolChange).toHaveBeenCalledWith("box");
  });
});

describe("AnnotationEditorOverlay — placing shapes", () => {
  it("places a numbered marker at the clicked point and returns the tool to select mode", () => {
    const { canvas, onAnnotationsChange, onActiveToolChange } = renderOverlay({ activeTool: "marker" });

    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 80, clientY: 60, pointerId: 1 });

    expect(onAnnotationsChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: "marker", order: 1, x: 0.1, y: 0.1 }),
    ]);
    expect(onActiveToolChange).toHaveBeenCalledWith(null);
  });

  it("numbers sequential markers using the highest existing order + 1", () => {
    const existing: Annotation[] = [{ id: "a1", type: "marker", order: 1, color: "#fff", x: 0.2, y: 0.2 }];
    const { canvas, onAnnotationsChange } = renderOverlay({ activeTool: "marker", annotations: existing });

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 400, clientY: 300, pointerId: 1 });

    expect(onAnnotationsChange).toHaveBeenCalledWith([
      existing[0],
      expect.objectContaining({ type: "marker", order: 2 }),
    ]);
  });

  it("grows a box annotation as the pointer drags, updating on every intermediate frame (not just on release)", () => {
    const { canvas, onAnnotationsChange } = renderOverlay({ activeTool: "box" });

    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 240, clientY: 180, pointerId: 1 });

    // Mid-drag: the growing shape must already be reflected, not frozen at a 1x1 dot.
    expect(onAnnotationsChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: "box", x: 0.1, y: 0.1, width: 0.2, height: 0.2 }),
    ]);

    fireEvent.pointerMove(window, { clientX: 320, clientY: 240, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 320, clientY: 240, pointerId: 1 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ type: "box", x: 0.1, y: 0.1, width: 0.3, height: 0.3 }),
    ]);
  });

  it("draws an arrow from the drag's start point to its end point", () => {
    const { canvas, onAnnotationsChange } = renderOverlay({ activeTool: "arrow" });

    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 400, clientY: 300, pointerId: 1 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ type: "arrow", x: 0.1, y: 0.1, x2: 0.5, y2: 0.5 }),
    ]);
  });

  it("places a text label and shows an editable input for it immediately", () => {
    const { canvas } = renderOverlay({ activeTool: "label" });
    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 80, clientY: 60, pointerId: 1 });

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("updates a label's text as the user types into its inline editor", () => {
    const existing: Annotation[] = [{ id: "a1", type: "label", order: 1, color: "#fff", x: 0.1, y: 0.1, text: "" }];
    const { onAnnotationsChange } = renderOverlay({ annotations: existing });

    fireEvent.pointerDown(screen.getByTestId("annotation-a1"), { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Klik di sini" } });

    expect(onAnnotationsChange).toHaveBeenCalledWith([expect.objectContaining({ id: "a1", text: "Klik di sini" })]);
  });

  it("does nothing on a background click when no tool is selected (select mode)", () => {
    const { canvas, onAnnotationsChange } = renderOverlay({ activeTool: null });
    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 80, clientY: 60, pointerId: 1 });
    expect(onAnnotationsChange).not.toHaveBeenCalled();
  });
});

describe("AnnotationEditorOverlay — select, move, delete", () => {
  const marker: Annotation = { id: "a1", type: "marker", order: 1, color: "#fff", x: 0.1, y: 0.1 };

  it("selects an existing annotation when clicked", () => {
    renderOverlay({ annotations: [marker] });
    fireEvent.pointerDown(screen.getByTestId("annotation-a1"), { clientX: 80, clientY: 60, pointerId: 1 });
    expect(screen.getByTestId("annotation-a1")).toHaveAttribute("data-selected", "true");
  });

  it("drags a selected shape to a new position", () => {
    const { onAnnotationsChange } = renderOverlay({ annotations: [marker] });
    const shape = screen.getByTestId("annotation-a1");

    fireEvent.pointerDown(shape, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 160, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 160, clientY: 120, pointerId: 1 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: "a1", x: 0.2, y: 0.2 })]);
  });

  it("deletes the selected annotation on Delete/Backspace", () => {
    const { onAnnotationsChange } = renderOverlay({ annotations: [marker] });
    fireEvent.pointerDown(screen.getByTestId("annotation-a1"), { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onAnnotationsChange).toHaveBeenCalledWith([]);
  });

  it("does not delete anything when nothing is selected", () => {
    const { onAnnotationsChange } = renderOverlay({ annotations: [marker] });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onAnnotationsChange).not.toHaveBeenCalled();
  });

  it("deselects when clicking empty background", () => {
    renderOverlay({ annotations: [marker] });
    fireEvent.pointerDown(screen.getByTestId("annotation-a1"), { clientX: 80, clientY: 60, pointerId: 1 });
    expect(screen.getByTestId("annotation-a1")).toHaveAttribute("data-selected", "true");

    const canvas = screen.getByTestId("annotation-editor-canvas");
    fireEvent.pointerDown(canvas, { clientX: 500, clientY: 500, pointerId: 2 });
    expect(screen.getByTestId("annotation-a1")).toHaveAttribute("data-selected", "false");
  });
});
