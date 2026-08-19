import type { Annotation } from "@/lib/types";

/**
 * Static, non-interactive read of the Annotation array, rendered as plain
 * SVG on top of the locked screenshot thumbnail — renders identically for
 * the author and readers, with edit affordances hidden. The viewBox matches
 * the image's own native pixel size and every coordinate is stored as a
 * fraction (0..1) of it, so shapes stay correctly aligned at any rendered
 * display size without a separate canvas-size calculation.
 */
export function AnnotationOverlay({
  annotations,
  imageWidth,
  imageHeight,
}: {
  annotations: Annotation[];
  imageWidth: number;
  imageHeight: number;
}) {
  if (!annotations.length) return null;

  const strokeWidth = annotationStrokeWidth(imageWidth);

  return (
    <svg viewBox={`0 0 ${imageWidth} ${imageHeight}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        {annotations
          .filter((a) => a.type === "arrow")
          .map((a) => (
            <marker key={a.id} id={`arrowhead-${a.id}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={a.color} />
            </marker>
          ))}
      </defs>
      {annotations.map((a) => (
        <AnnotationShape key={a.id} annotation={a} imageWidth={imageWidth} imageHeight={imageHeight} strokeWidth={strokeWidth} />
      ))}
    </svg>
  );
}

/** Roughly proportional to the image's own resolution, matching how the shape looked when it was drawn. */
export function annotationStrokeWidth(imageWidth: number): number {
  return Math.max(2, imageWidth * 0.0035);
}

export function AnnotationShape({
  annotation,
  imageWidth,
  imageHeight,
  strokeWidth,
}: {
  annotation: Annotation;
  imageWidth: number;
  imageHeight: number;
  strokeWidth: number;
}) {
  const x = annotation.x * imageWidth;
  const y = annotation.y * imageHeight;

  switch (annotation.type) {
    case "box": {
      const width = (annotation.width ?? 0) * imageWidth;
      const height = (annotation.height ?? 0) * imageHeight;
      return <rect x={x} y={y} width={width} height={height} fill="none" stroke={annotation.color} strokeWidth={strokeWidth} rx={4} />;
    }
    case "arrow": {
      const x2 = (annotation.x2 ?? annotation.x) * imageWidth;
      const y2 = (annotation.y2 ?? annotation.y) * imageHeight;
      return (
        <line x1={x} y1={y} x2={x2} y2={y2} stroke={annotation.color} strokeWidth={strokeWidth} markerEnd={`url(#arrowhead-${annotation.id})`} />
      );
    }
    case "marker": {
      const radius = strokeWidth * 4.5;
      return (
        <g>
          <circle cx={x} cy={y} r={radius} fill={annotation.color} />
          <text x={x} y={y} fill="#ffffff" fontSize={radius} fontWeight={700} textAnchor="middle" dominantBaseline="central">
            {annotation.order}
          </text>
        </g>
      );
    }
    case "label":
      return (
        <text x={x} y={y} fill={annotation.color} fontSize={Math.max(12, imageWidth * 0.02)} fontWeight={600} dominantBaseline="hanging">
          {annotation.text}
        </text>
      );
    default:
      return null;
  }
}
