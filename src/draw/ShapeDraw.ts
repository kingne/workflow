import { Draw } from "./Draw.ts";
import type { Point } from "../types.ts";
import { createRoundedRectPath } from "../utils/canvas.ts";

type RectGeometry = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
};

type CircleGeometry = {
  kind: "circle";
  x: number;
  y: number;
  radius: number;
};

type PolygonGeometry = {
  kind: "polygon";
  points: Point[];
};

type ShapeGeometry = RectGeometry | CircleGeometry | PolygonGeometry;

type ShapeDrawStyle = {
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  globalAlpha?: number;
};

export class ShapeDraw extends Draw {
  constructor(
    public geometry: ShapeGeometry,
    public style: ShapeDrawStyle = {},
    renderSpace: "world" | "screen" = "world",
  ) {
    super(renderSpace);
  }

  setGeometry(geometry: ShapeGeometry) {
    this.geometry = geometry;
  }

  setStyle(style: Partial<ShapeDrawStyle>) {
    this.style = { ...this.style, ...style };
  }

  override hitTest(point: Point) {
    if (this.geometry.kind === "rect") {
      const { x, y, width, height } = this.geometry;
      return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
    }

    if (this.geometry.kind === "circle") {
      const offsetX = point.x - this.geometry.x;
      const offsetY = point.y - this.geometry.y;
      return Math.hypot(offsetX, offsetY) <= this.geometry.radius;
    }

    return isPointInPolygon(point, this.geometry.points);
  }

  protected onDraw(context: CanvasRenderingContext2D) {
    const path = this.createPath();

    context.globalAlpha = this.style.globalAlpha ?? 1;
    context.shadowColor = this.style.shadowColor ?? "transparent";
    context.shadowBlur = this.style.shadowBlur ?? 0;
    context.shadowOffsetX = this.style.shadowOffsetX ?? 0;
    context.shadowOffsetY = this.style.shadowOffsetY ?? 0;

    if (this.style.fillStyle) {
      context.fillStyle = this.style.fillStyle;
      context.fill(path);
    }

    if (this.style.strokeStyle) {
      context.strokeStyle = this.style.strokeStyle;
      context.lineWidth = this.style.lineWidth ?? 1;
      context.stroke(path);
    }
  }

  private createPath() {
    const path = new Path2D();

    if (this.geometry.kind === "rect") {
      const { x, y, width, height, radius = 0 } = this.geometry;
      createRoundedRectPath(path, x, y, width, height, radius);
      return path;
    }

    if (this.geometry.kind === "circle") {
      path.moveTo(this.geometry.x + this.geometry.radius, this.geometry.y);
      path.arc(this.geometry.x, this.geometry.y, this.geometry.radius, 0, Math.PI * 2);
      path.closePath();
      return path;
    }

    const [firstPoint, ...restPoints] = this.geometry.points;

    if (!firstPoint) {
      return path;
    }

    path.moveTo(firstPoint.x, firstPoint.y);
    restPoints.forEach((point) => {
      path.lineTo(point.x, point.y);
    });
    path.closePath();
    return path;
  }
}

function isPointInPolygon(point: Point, polygon: Point[]) {
  let isInside = false;

  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previousIndex];

    if (!currentPoint || !previousPoint) {
      continue;
    }

    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          ((previousPoint.y - currentPoint.y) || 1e-6) +
          currentPoint.x;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}
