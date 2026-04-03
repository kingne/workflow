import { Draw } from "./Draw.ts";
import { createRoundedRectPath } from "../utils/canvas.ts";
import type { Point } from "../types.ts";

type RoundedRectGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

export class RunningBorderDraw extends Draw {
  private active = false;
  private color = "#2563eb";
  private geometry: RoundedRectGeometry = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    radius: 0,
  };

  setGeometry(geometry: RoundedRectGeometry) {
    this.geometry = geometry;
  }

  setActive(active: boolean) {
    this.active = active;
  }

  setColor(color: string) {
    this.color = color;
  }

  override hitTest(_point: Point) {
    return false;
  }

  protected onDraw(context: CanvasRenderingContext2D) {
    if (!this.active) {
      return;
    }

    const { x, y, width, height, radius } = this.geometry;
    const path = new Path2D();
    createRoundedRectPath(path, x, y, width, height, radius);

    const perimeter = getRoundedRectPerimeter(width, height, radius);
    const glowLength = Math.max(44, perimeter * 0.16);
    const gapLength = Math.max(24, perimeter - glowLength);
    const dashOffset = -((performance.now() * 0.18) % perimeter);

    context.strokeStyle = toRgba(this.color, 0.16);
    context.lineWidth = 2.5;
    context.stroke(path);

    context.strokeStyle = this.color;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = toRgba(this.color, 0.65);
    context.shadowBlur = 16;
    context.setLineDash([glowLength, gapLength]);
    context.lineDashOffset = dashOffset;
    context.stroke(path);
  }
}

function getRoundedRectPerimeter(width: number, height: number, radius: number) {
  const boundedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  return 2 * (width + height - 4 * boundedRadius) + 2 * Math.PI * boundedRadius;
}

function toRgba(color: string, alpha: number) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;

    if (normalized.length === 6) {
      const red = Number.parseInt(normalized.slice(0, 2), 16);
      const green = Number.parseInt(normalized.slice(2, 4), 16);
      const blue = Number.parseInt(normalized.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }

  return color;
}
