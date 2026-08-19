import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AnnotationOverlay } from "./annotation-overlay";
import type { Annotation } from "@/lib/types";

describe("AnnotationOverlay", () => {
  it("renders nothing when there are no annotations", () => {
    const { container } = render(<AnnotationOverlay annotations={[]} imageWidth={800} imageHeight={600} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("uses the image's own native pixel size as the viewBox, not a scaled-down copy", () => {
    const annotations: Annotation[] = [{ id: "a1", type: "label", order: 1, color: "#fff", x: 0.1, y: 0.1, text: "Hi" }];
    const { container } = render(<AnnotationOverlay annotations={annotations} imageWidth={1600} imageHeight={900} />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 1600 900");
  });

  it("renders a box annotation as a rect positioned from fractional coordinates", () => {
    const annotations: Annotation[] = [{ id: "a1", type: "box", order: 1, color: "#ff0000", x: 0.1, y: 0.2, width: 0.3, height: 0.15 }];
    const { container } = render(<AnnotationOverlay annotations={annotations} imageWidth={1000} imageHeight={500} />);
    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("x", "100");
    expect(rect).toHaveAttribute("y", "100");
    expect(rect).toHaveAttribute("width", "300");
    expect(rect).toHaveAttribute("height", "75");
    expect(rect).toHaveAttribute("stroke", "#ff0000");
    expect(rect).toHaveAttribute("fill", "none");
  });

  it("renders an arrow annotation as a line with an arrowhead marker", () => {
    const annotations: Annotation[] = [{ id: "a1", type: "arrow", order: 1, color: "#00ff00", x: 0.1, y: 0.1, x2: 0.5, y2: 0.5 }];
    const { container } = render(<AnnotationOverlay annotations={annotations} imageWidth={1000} imageHeight={1000} />);
    const line = container.querySelector("line");
    expect(line).toHaveAttribute("x1", "100");
    expect(line).toHaveAttribute("y1", "100");
    expect(line).toHaveAttribute("x2", "500");
    expect(line).toHaveAttribute("y2", "500");
    expect(line).toHaveAttribute("marker-end", "url(#arrowhead-a1)");
    expect(container.querySelector("marker#arrowhead-a1")).toBeInTheDocument();
  });

  it("renders a marker annotation as a numbered circle at its point", () => {
    const annotations: Annotation[] = [{ id: "a1", type: "marker", order: 3, color: "#123456", x: 0.5, y: 0.5 }];
    const { container } = render(<AnnotationOverlay annotations={annotations} imageWidth={800} imageHeight={800} />);
    const circle = container.querySelector("circle");
    expect(circle).toHaveAttribute("cx", "400");
    expect(circle).toHaveAttribute("cy", "400");
    expect(circle).toHaveAttribute("fill", "#123456");
    expect(container.querySelector("text")).toHaveTextContent("3");
  });

  it("renders a label annotation as text at its point", () => {
    const annotations: Annotation[] = [{ id: "a1", type: "label", order: 1, color: "#000000", x: 0.25, y: 0.25, text: "Klik di sini" }];
    const { container } = render(<AnnotationOverlay annotations={annotations} imageWidth={400} imageHeight={400} />);
    const text = container.querySelector("text");
    expect(text).toHaveAttribute("x", "100");
    expect(text).toHaveAttribute("y", "100");
    expect(text).toHaveTextContent("Klik di sini");
  });

  it("renders every annotation in the array, keyed by its own id", () => {
    const annotations: Annotation[] = [
      { id: "a1", type: "marker", order: 1, color: "#fff", x: 0.1, y: 0.1 },
      { id: "a2", type: "marker", order: 2, color: "#fff", x: 0.2, y: 0.2 },
    ];
    const { container } = render(<AnnotationOverlay annotations={annotations} imageWidth={800} imageHeight={600} />);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  it("marks the overlay non-interactive so it never blocks clicks meant for the image beneath it", () => {
    const annotations: Annotation[] = [{ id: "a1", type: "marker", order: 1, color: "#fff", x: 0.1, y: 0.1 }];
    const { container } = render(<AnnotationOverlay annotations={annotations} imageWidth={800} imageHeight={600} />);
    expect(container.querySelector("svg")).toHaveClass("pointer-events-none");
  });
});
