/**
 * The Fabric.js editing canvas (AnnotationCanvas) caps its drawing surface at
 * ANNOTATION_MAX_CANVAS_WIDTH and draws/serializes every annotation shape in
 * that display-scaled coordinate space, not the screenshot's native pixel
 * space. The read-only overlay (AnnotationOverlay) must size its SVG viewBox
 * to the exact same scaled dimensions, or every shape drifts and stretches
 * relative to the actual rendered image once the annotation is saved.
 */
export const ANNOTATION_MAX_CANVAS_WIDTH = 960;

export function getAnnotationCanvasSize(imageWidth: number, imageHeight: number) {
  const scale = imageWidth > ANNOTATION_MAX_CANVAS_WIDTH ? ANNOTATION_MAX_CANVAS_WIDTH / imageWidth : 1;
  return {
    scale,
    width: Math.round(imageWidth * scale),
    height: Math.round(imageHeight * scale),
  };
}
