import { describe, it, expect } from "vitest";
import { ANNOTATION_MAX_CANVAS_WIDTH, getAnnotationCanvasSize } from "./annotation-canvas-size";

describe("getAnnotationCanvasSize", () => {
  it("returns the image's native size unscaled when it fits within the max canvas width", () => {
    expect(getAnnotationCanvasSize(800, 450)).toEqual({ scale: 1, width: 800, height: 450 });
  });

  it("scales down proportionally when the image exceeds the max canvas width", () => {
    const result = getAnnotationCanvasSize(1600, 900);
    expect(result.scale).toBeCloseTo(ANNOTATION_MAX_CANVAS_WIDTH / 1600);
    expect(result.width).toBe(ANNOTATION_MAX_CANVAS_WIDTH);
    expect(result.height).toBe(Math.round(900 * (ANNOTATION_MAX_CANVAS_WIDTH / 1600)));
  });

  it("never upscales an image narrower than the max canvas width", () => {
    const result = getAnnotationCanvasSize(500, 300);
    expect(result.scale).toBe(1);
    expect(result.width).toBe(500);
    expect(result.height).toBe(300);
  });

  it("preserves aspect ratio when scaling down", () => {
    const result = getAnnotationCanvasSize(1920, 1080);
    expect(result.width / result.height).toBeCloseTo(1920 / 1080, 2);
  });
});
