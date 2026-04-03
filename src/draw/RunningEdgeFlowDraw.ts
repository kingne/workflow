import { Draw } from "./Draw.ts";
import type { Point } from "../types.ts";

type BezierGeometry = {
  start: Point;
  control1: Point;
  control2: Point;
  end: Point;
};

export class RunningEdgeFlowDraw extends Draw {
  private active = false;
  private color = "#2563eb";
  private lineWidth = 3;
  private geometry: BezierGeometry = {
    start: { x: 0, y: 0 },
    control1: { x: 0, y: 0 },
    control2: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
  };

  setGeometry(geometry: BezierGeometry) {
    this.geometry = geometry;
  }

  setActive(active: boolean) {
    this.active = active;
  }

  setColor(color: string) {
    this.color = color;
  }

  setLineWidth(lineWidth: number) {
    this.lineWidth = lineWidth;
  }

  override hitTest(_point: Point) {
    return false;
  }

  protected onDraw(context: CanvasRenderingContext2D) {
    if (!this.active) {
      return;
    }

    const { start, control1, control2, end } = this.geometry;
    const dashCycle = 22;

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.bezierCurveTo(
      control1.x,
      control1.y,
      control2.x,
      control2.y,
      end.x,
      end.y,
    );
    context.strokeStyle = this.color;
    context.lineWidth = Math.max(2, this.lineWidth - 0.25);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalAlpha = 0.95;
    context.shadowColor = toRgba(this.color, 0.55);
    context.shadowBlur = 10;
    context.setLineDash([12, 10]);
    context.lineDashOffset = -((performance.now() / 45) % dashCycle);
    context.stroke();
  }
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
