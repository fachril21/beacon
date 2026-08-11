import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AnnotationOverlay } from "./annotation-overlay";
import { getAnnotationCanvasSize } from "@/lib/annotation-canvas-size";
import type { AnnotationJson } from "@/lib/types";

const annotation: AnnotationJson = {
  version: "7.0",
  objects: [{ type: "Rect", left: 100, top: 80, width: 400, height: 200, fill: "transparent", stroke: "red", strokeWidth: 3 }],
  nextMarkerNumber: 1,
};

// Regression coverage for the editing-vs-saved-preview misalignment bug: the
// Fabric.js AnnotationCanvas caps its drawing surface at
// ANNOTATION_MAX_CANVAS_WIDTH and serializes shape coordinates in that
// scaled-down space, not the image's native pixel space. AnnotationOverlay
// must use the exact same scaled dimensions as its SVG viewBox or every
// shape drifts and stretches relative to the actual rendered image.
describe("AnnotationOverlay alignment with the Fabric editing canvas", () => {
  it("uses the same scaled canvas dimensions as AnnotationCanvas for its viewBox on a wide image, not the raw native size", () => {
    const imageWidth = 1600;
    const imageHeight = 900;
    const { container } = render(<AnnotationOverlay annotation={annotation} imageWidth={imageWidth} imageHeight={imageHeight} />);
    const svg = container.querySelector("svg");
    const { width, height } = getAnnotationCanvasSize(imageWidth, imageHeight);

    expect(svg).toHaveAttribute("viewBox", `0 0 ${width} ${height}`);
    // Guard against regressing back to the raw native size, which is exactly the reported bug.
    expect(svg?.getAttribute("viewBox")).not.toBe(`0 0 ${imageWidth} ${imageHeight}`);
  });

  it("keeps the viewBox equal to the native image size when the image already fits the canvas (scale === 1)", () => {
    const { container } = render(<AnnotationOverlay annotation={annotation} imageWidth={800} imageHeight={450} />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 800 450");
  });

  it("renders a Rect at its stored coordinates unchanged (the overlay only rescales the coordinate system, not the object data)", () => {
    const { container } = render(<AnnotationOverlay annotation={annotation} imageWidth={1600} imageHeight={900} />);
    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("x", "100");
    expect(rect).toHaveAttribute("y", "80");
    expect(rect).toHaveAttribute("width", "400");
    expect(rect).toHaveAttribute("height", "200");
  });

  // The numbered marker tool (annotation-canvas.tsx) draws a Fabric Group
  // containing a Circle + Text, left/top-anchored on the group's own box —
  // this is exactly the "marker 1 / marker 2" shape shown drifting in the
  // reported bug, so it gets its own coordinate-mapping coverage here.
  it("renders a numbered-marker Group (Circle + Text) translated to the group's own left/top box, with the number centered on the circle", () => {
    const markerAnnotation: AnnotationJson = {
      version: "7.0",
      objects: [
        {
          type: "Group",
          left: 50,
          top: 40,
          width: 28,
          height: 28,
          objects: [
            { type: "Circle", left: 0, top: 0, radius: 14, fill: "green", originX: "center", originY: "center" },
            { type: "Text", left: 0, top: 0, text: "1", fontSize: 14, fill: "#141B24", originX: "center", originY: "center" },
          ],
        },
      ],
      nextMarkerNumber: 2,
    };
    const { container } = render(<AnnotationOverlay annotation={markerAnnotation} imageWidth={800} imageHeight={450} />);
    const group = container.querySelector("g");
    expect(group).toHaveAttribute("transform", "translate(64, 54)");
    expect(container.querySelector("circle")).toHaveAttribute("r", "14");

    const text = container.querySelector("text");
    expect(text).toHaveTextContent("1");
    // Both children share the circle's own center point (0, 0) local to the
    // group — the text must render anchored on that same center, not offset
    // down-and-right as if it were top-left anchored (the reported bug).
    expect(text).toHaveAttribute("x", "0");
    expect(text).toHaveAttribute("y", "0");
    expect(text).toHaveAttribute("text-anchor", "middle");
    expect(text).toHaveAttribute("dominant-baseline", "central");
  });

  it("renders a Line (used for the arrow tool's shaft)", () => {
    const lineAnnotation: AnnotationJson = {
      version: "7.0",
      objects: [{ type: "Line", x1: 10, y1: 20, x2: 110, y2: 220, stroke: "red", strokeWidth: 4 }],
      nextMarkerNumber: 1,
    };
    const { container } = render(<AnnotationOverlay annotation={lineAnnotation} imageWidth={800} imageHeight={450} />);
    const line = container.querySelector("line");
    expect(line).toHaveAttribute("x1", "10");
    expect(line).toHaveAttribute("y2", "220");
  });

  it("renders a Triangle (used for the arrow tool's head) rotated around its own center", () => {
    const triangleAnnotation: AnnotationJson = {
      version: "7.0",
      objects: [{ type: "Triangle", left: 100, top: 200, width: 14, height: 16, angle: 45, fill: "red" }],
      nextMarkerNumber: 1,
    };
    const { container } = render(<AnnotationOverlay annotation={triangleAnnotation} imageWidth={800} imageHeight={450} />);
    expect(container.querySelector("g")).toHaveAttribute("transform", "translate(100, 200) rotate(45)");
    expect(container.querySelector("polygon")).toBeInTheDocument();
  });

  it("renders IText/Textbox label objects as SVG text", () => {
    const labelAnnotation: AnnotationJson = {
      version: "7.0",
      objects: [{ type: "IText", left: 30, top: 40, text: "Label", fontSize: 16, fill: "red" }],
      nextMarkerNumber: 1,
    };
    const { container } = render(<AnnotationOverlay annotation={labelAnnotation} imageWidth={800} imageHeight={450} />);
    expect(container.querySelector("text")).toHaveTextContent("Label");
  });

  it("skips an object of an unrecognized type instead of throwing", () => {
    const unknownAnnotation: AnnotationJson = {
      version: "7.0",
      objects: [{ type: "Image" }],
      nextMarkerNumber: 1,
    };
    const { container } = render(<AnnotationOverlay annotation={unknownAnnotation} imageWidth={800} imageHeight={450} />);
    expect(container.querySelector("svg")?.children.length).toBe(0);
  });
});
