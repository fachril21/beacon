import { getAnnotationCanvasSize } from "@/lib/annotation-canvas-size";
import type { AnnotationJson } from "@/lib/types";

interface FabricObjectJson {
  type?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  fontSize?: number;
  angle?: number;
  originX?: string;
  originY?: string;
  objects?: FabricObjectJson[];
}

/**
 * Static, non-interactive read of Fabric.js's serialized annotation objects,
 * rendered as SVG on top of the locked screenshot thumbnail (Fabric itself
 * only mounts while actively annotating — PRD.md Flow 3 step 6: "renders
 * identically for the author and readers, with edit affordances hidden").
 *
 * Fabric v7 serializes `type` in PascalCase ("Rect", "Group", "Image", …).
 */
export function AnnotationOverlay({
  annotation,
  imageWidth,
  imageHeight,
}: {
  annotation: AnnotationJson | null;
  imageWidth: number;
  imageHeight: number;
}) {
  if (!annotation?.objects?.length) return null;

  // Objects were drawn on (and their coordinates serialized from) the Fabric
  // editing canvas's scaled-down size, not the image's native pixel size —
  // the viewBox must match that same scaled coordinate space for shapes to
  // land exactly where they were drawn, at any rendered display size.
  const { width, height } = getAnnotationCanvasSize(imageWidth, imageHeight);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {(annotation.objects as FabricObjectJson[]).map((obj, i) => renderObject(obj, i))}
    </svg>
  );
}

function renderObject(obj: FabricObjectJson, key: number) {
  switch (obj.type) {
    case "Rect": {
      const isCentered = obj.originX === "center";
      const x = isCentered ? (obj.left ?? 0) - (obj.width ?? 0) / 2 : (obj.left ?? 0);
      const y = isCentered ? (obj.top ?? 0) - (obj.height ?? 0) / 2 : (obj.top ?? 0);
      return (
        <rect
          key={key}
          x={x}
          y={y}
          width={obj.width}
          height={obj.height}
          fill={obj.fill && obj.fill !== "transparent" ? obj.fill : "none"}
          stroke={obj.stroke && obj.stroke !== "transparent" ? obj.stroke : "none"}
          strokeWidth={obj.strokeWidth ?? 0}
          rx={4}
        />
      );
    }
    case "Line":
      return <line key={key} x1={obj.x1} y1={obj.y1} x2={obj.x2} y2={obj.y2} stroke={obj.stroke} strokeWidth={obj.strokeWidth ?? 3} />;
    case "IText":
    case "Textbox":
    case "Text": {
      // The label tool anchors text top-left (the default), but the
      // numbered-marker tool anchors its number center/center on the
      // circle's own center — SVG has no "center" origin for <text>, so a
      // center-anchored object needs text-anchor + dominant-baseline
      // instead of the top-left baseline-offset math below.
      const isCenteredX = obj.originX === "center";
      const isCenteredY = obj.originY === "center";
      const x = obj.left ?? 0;
      const y = isCenteredY ? (obj.top ?? 0) : (obj.top ?? 0) + (obj.fontSize ?? 16);
      return (
        <text
          key={key}
          x={x}
          y={y}
          fill={obj.fill}
          fontSize={obj.fontSize ?? 16}
          fontWeight={600}
          textAnchor={isCenteredX ? "middle" : "start"}
          dominantBaseline={isCenteredY ? "central" : "auto"}
        >
          {obj.text}
        </text>
      );
    }
    case "Group": {
      // Fabric stores group children relative to the group's own center.
      const cx = (obj.left ?? 0) + (obj.width ?? 0) / 2;
      const cy = (obj.top ?? 0) + (obj.height ?? 0) / 2;
      return (
        <g key={key} transform={`translate(${cx}, ${cy})`}>
          {obj.objects?.map((child, i) => renderObject(child, i))}
        </g>
      );
    }
    case "Circle":
      return <circle key={key} cx={obj.left ?? 0} cy={obj.top ?? 0} r={obj.radius} fill={obj.fill} />;
    case "Triangle": {
      const w = obj.width ?? 14;
      const h = obj.height ?? 16;
      const cx = obj.left ?? 0;
      const cy = obj.top ?? 0;
      const angle = obj.angle ?? 0;
      return (
        <g key={key} transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
          <polygon points={`0,${-h / 2} ${w / 2},${h / 2} ${-w / 2},${h / 2}`} fill={obj.fill} />
        </g>
      );
    }
    default:
      return null;
  }
}
