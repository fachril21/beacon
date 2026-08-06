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

  return (
    <svg
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
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
    case "Text":
      return (
        <text key={key} x={obj.left} y={(obj.top ?? 0) + (obj.fontSize ?? 16)} fill={obj.fill} fontSize={obj.fontSize ?? 16} fontWeight={600}>
          {obj.text}
        </text>
      );
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
