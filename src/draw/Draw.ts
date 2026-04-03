import type { Point } from "../types.ts";

export type DrawMouseEvent = {
  target: Draw;
  currentTarget: Draw;
  screenPoint: Point;
  worldPoint: Point;
  point: Point;
  originalEvent: PointerEvent;
};

type DrawMouseEventType = "mouseenter" | "mouseleave" | "mousemove" | "click";
type DrawMouseHandler = (event: DrawMouseEvent) => void;

export abstract class Draw {
  visible = true;
  readonly renderSpace: "world" | "screen";
  parent: Draw | null = null;
  private handlers: Record<DrawMouseEventType, DrawMouseHandler[]> = {
    mouseenter: [],
    mouseleave: [],
    mousemove: [],
    click: [],
  };

  constructor(renderSpace: "world" | "screen" = "world") {
    this.renderSpace = renderSpace;
  }

  draw(context: CanvasRenderingContext2D) {
    if (!this.visible) {
      return;
    }

    context.save();
    this.onDraw(context);
    context.restore();
  }

  hitTest(_point: Point) {
    return false;
  }

  findTarget(point: Point): Draw | null {
    if (!this.visible) {
      return null;
    }

    return this.hitTest(point) ? this : null;
  }

  setParent(parent: Draw | null) {
    this.parent = parent;
  }

  onMouseEnter(handler: DrawMouseHandler) {
    this.handlers.mouseenter.push(handler);
    return this;
  }

  onMouseLeave(handler: DrawMouseHandler) {
    this.handlers.mouseleave.push(handler);
    return this;
  }

  onMouseMove(handler: DrawMouseHandler) {
    this.handlers.mousemove.push(handler);
    return this;
  }

  onClick(handler: DrawMouseHandler) {
    this.handlers.click.push(handler);
    return this;
  }

  emit(type: DrawMouseEventType, event: DrawMouseEvent) {
    this.handlers[type].forEach((handler) => handler(event));
  }

  hasMouseHandlers() {
    return Object.values(this.handlers).some((handlers) => handlers.length > 0);
  }

  protected abstract onDraw(context: CanvasRenderingContext2D): void;
}
