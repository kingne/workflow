import { Draw } from "./Draw.ts";
import type { Rect } from "../types.ts";

export class SelectionBoxDraw extends Draw {
  private rect: Rect | null = null;

  constructor() {
    super("screen");
    this.visible = false;
  }

  setRect(rect: Rect | null) {
    this.rect = rect;
    this.visible = rect !== null;
  }

  protected onDraw(context: CanvasRenderingContext2D) {
    if (!this.rect) {
      return;
    }

    context.fillStyle = "rgba(37, 99, 235, 0.08)";
    context.strokeStyle = "rgba(37, 99, 235, 0.9)";
    context.lineWidth = 1;
    context.setLineDash([6, 4]);
    context.fillRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
    context.strokeRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
  }
}
