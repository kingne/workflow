import { Draw } from "./Draw.ts";
import type { Size, ViewTransform } from "../types.ts";

type GridDrawOptions = {
  gap?: number;
  backgroundColor?: string;
  lineColor?: string;
};

export class GridDraw extends Draw {
  constructor(
    private getViewportSize: () => Size,
    private getViewTransform: () => ViewTransform,
    private options: GridDrawOptions = {},
  ) {
    super("screen");
  }

  protected onDraw(context: CanvasRenderingContext2D) {
    const { width, height } = this.getViewportSize();
    const transform = this.getViewTransform();
    const baseGap = this.options.gap ?? 24;
    const gap = getVisibleGap(baseGap, transform.scale);
    const offsetX = getScreenOffset(transform.x, gap);
    const offsetY = getScreenOffset(transform.y, gap);

    context.fillStyle = this.options.backgroundColor ?? "#f4f7fb";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = this.options.lineColor ?? "rgba(148, 163, 184, 0.16)";
    context.lineWidth = 1;

    for (let x = offsetX; x <= width; x += gap) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    for (let y = offsetY; y <= height; y += gap) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }
}

function getVisibleGap(baseGap: number, scale: number) {
  let visibleGap = baseGap * scale;

  while (visibleGap < 18) {
    visibleGap *= 2;
  }

  return visibleGap;
}

function getScreenOffset(translation: number, gap: number) {
  return ((translation % gap) + gap) % gap;
}
