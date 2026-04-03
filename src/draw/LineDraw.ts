import { Draw } from "./Draw.ts";
import type { Point } from "../types.ts";

type PolylineGeometry = {
  kind: "polyline";
  points: Point[];
};

type BezierGeometry = {
  kind: "bezier";
  start: Point;
  control1: Point;
  control2: Point;
  end: Point;
};

type LineGeometry = PolylineGeometry | BezierGeometry;

type LineDrawStyle = {
  strokeStyle?: string;
  lineWidth?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  dash?: number[];
  globalAlpha?: number;
};

export class LineDraw extends Draw {
  constructor(
    public geometry: LineGeometry,
    public style: LineDrawStyle = {},
    renderSpace: "world" | "screen" = "world",
  ) {
    super(renderSpace);
  }

  setGeometry(geometry: LineGeometry) {
    this.geometry = geometry;
  }

  setStyle(style: Partial<LineDrawStyle>) {
    this.style = { ...this.style, ...style };
  }

  override hitTest(point: Point) {
    const threshold = Math.max(6, (this.style.lineWidth ?? 1) + 4);

    if (this.geometry.kind === "polyline") {
      for (let index = 1; index < this.geometry.points.length; index += 1) {
        const start = this.geometry.points[index - 1];
        const end = this.geometry.points[index];

        if (start && end && distanceToSegment(point, start, end) <= threshold) {
          return true;
        }
      }

      return false;
    }

    let previousPoint = this.geometry.start;
    const segments = 24;

    for (let step = 1; step <= segments; step += 1) {
      const t = step / segments;
      const currentPoint = getBezierPoint(this.geometry, t);

      if (distanceToSegment(point, previousPoint, currentPoint) <= threshold) {
        return true;
      }

      previousPoint = currentPoint;
    }

    return false;
  }

  protected onDraw(context: CanvasRenderingContext2D) {
    context.beginPath();

    if (this.geometry.kind === "polyline") {
      const [firstPoint, ...restPoints] = this.geometry.points;

      if (!firstPoint) {
        return;
      }

      context.moveTo(firstPoint.x, firstPoint.y);
      restPoints.forEach((point) => {
        context.lineTo(point.x, point.y);
      });
    } else {
      const { start, control1, control2, end } = this.geometry;
      context.moveTo(start.x, start.y);
      context.bezierCurveTo(
        control1.x,
        control1.y,
        control2.x,
        control2.y,
        end.x,
        end.y,
      );
    }

    context.strokeStyle = this.style.strokeStyle ?? "#475569";
    context.lineWidth = this.style.lineWidth ?? 1;
    context.lineCap = this.style.lineCap ?? "butt";
    context.lineJoin = this.style.lineJoin ?? "miter";
    context.globalAlpha = this.style.globalAlpha ?? 1;
    context.setLineDash(this.style.dash ?? []);
    context.stroke();
  }
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clampedProjection = Math.max(0, Math.min(1, projection));
  const closestX = start.x + dx * clampedProjection;
  const closestY = start.y + dy * clampedProjection;

  return Math.hypot(point.x - closestX, point.y - closestY);
}

function getBezierPoint(
  geometry: Extract<LineGeometry, { kind: "bezier" }>,
  t: number,
): Point {
  const inverse = 1 - t;

  return {
    x:
      inverse * inverse * inverse * geometry.start.x +
      3 * inverse * inverse * t * geometry.control1.x +
      3 * inverse * t * t * geometry.control2.x +
      t * t * t * geometry.end.x,
    y:
      inverse * inverse * inverse * geometry.start.y +
      3 * inverse * inverse * t * geometry.control1.y +
      3 * inverse * t * t * geometry.control2.y +
      t * t * t * geometry.end.y,
  };
}
