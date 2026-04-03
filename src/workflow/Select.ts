import { SelectionBoxDraw } from "../draw/SelectionBoxDraw.ts";
import type { Point, Rect } from "../types.ts";
import type { RenderManager } from "../render/RenderManager.ts";
import type { Scene } from "./Scene.ts";

export class Select {
  private boxDraw = new SelectionBoxDraw();
  private startScreenPoint: Point | null = null;
  private currentScreenPoint: Point | null = null;
  private selecting = false;

  constructor(
    private scene: Scene,
    private renderManager: RenderManager,
  ) {
    this.scene.setScreenDraws([this.boxDraw]);
  }

  begin(screenPoint: Point) {
    this.startScreenPoint = { ...screenPoint };
    this.currentScreenPoint = { ...screenPoint };
    this.selecting = false;
    this.updateDraw();
  }

  update(screenPoint: Point) {
    if (!this.startScreenPoint) {
      return;
    }

    this.currentScreenPoint = { ...screenPoint };

    const screenRect = this.getScreenRect();
    if (!screenRect) {
      return;
    }

    this.selecting = screenRect.width > 4 || screenRect.height > 4;
    this.updateDraw();

    if (this.selecting) {
      this.scene.selectInRect(this.getWorldRect(screenRect));
    }
  }

  end() {
    const wasSelecting = this.selecting;
    this.startScreenPoint = null;
    this.currentScreenPoint = null;
    this.selecting = false;
    this.updateDraw();
    return wasSelecting;
  }

  selectByDraw(draw: import("../draw/Draw.ts").Draw | null) {
    const item = this.scene.resolveSelectable(draw);
    this.scene.selectOnly(item);
    return item;
  }

  clearSelection() {
    this.scene.clearSelection();
  }

  private updateDraw() {
    this.boxDraw.setRect(this.selecting ? this.getScreenRect() : null);
  }

  private getScreenRect(): Rect | null {
    if (!this.startScreenPoint || !this.currentScreenPoint) {
      return null;
    }

    return normalizeRect({
      x: this.startScreenPoint.x,
      y: this.startScreenPoint.y,
      width: this.currentScreenPoint.x - this.startScreenPoint.x,
      height: this.currentScreenPoint.y - this.startScreenPoint.y,
    });
  }

  private getWorldRect(screenRect: Rect) {
    const topLeft = this.renderManager.screenToWorld({ x: screenRect.x, y: screenRect.y });
    const bottomRight = this.renderManager.screenToWorld({
      x: screenRect.x + screenRect.width,
      y: screenRect.y + screenRect.height,
    });

    return normalizeRect({
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    });
  }
}

function normalizeRect(rect: Rect): Rect {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;

  return {
    x,
    y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
}
