import { Draw, type DrawRenderState } from "./Draw.ts";
import type { Point, Rect } from "../types.ts";

export class GroupDraw extends Draw {
  protected children: Draw[];

  constructor(children: Draw[] = [], renderSpace: "world" | "screen" = "world") {
    super(renderSpace);
    this.children = [];
    this.setChildren(children);
  }

  setChildren(children: Draw[]) {
    this.children.forEach((child) => child.setParent(null));
    this.children = children;
    this.children.forEach((child) => child.setParent(this));
  }

  getChildren() {
    return [...this.children];
  }

  add(child: Draw) {
    child.setParent(this);
    this.children.push(child);
  }

  protected onDraw(context: CanvasRenderingContext2D, renderState?: DrawRenderState) {
    this.children.forEach((child) => {
      if (!shouldRenderChild(child, renderState)) {
        return;
      }

      child.draw(context, renderState);
    });
  }

  override hitTest(point: Point) {
    return this.findTarget(point) !== null;
  }

  override findTarget(point: Point): Draw | null {
    if (!this.visible) {
      return null;
    }

    const bounds = this.getBounds();

    if (bounds && !containsPoint(bounds, point)) {
      return null;
    }

    for (let index = this.children.length - 1; index >= 0; index -= 1) {
      const child = this.children[index];

      if (!child) {
        continue;
      }

      const target = child.findTarget(point);

      if (target) {
        return target;
      }
    }

    if (this.hitTest !== GroupDraw.prototype.hitTest && this.hitTest(point)) {
      return this;
    }

    return null;
  }
}

function shouldRenderChild(child: Draw, renderState?: DrawRenderState) {
  if (!renderState) {
    return true;
  }

  const viewport = child.renderSpace === "screen" ? renderState.screenViewport : renderState.worldViewport;
  const bounds = child.getBounds();

  if (!viewport || !bounds) {
    return true;
  }

  return intersectsRect(bounds, viewport);
}

function intersectsRect(left: Rect, right: Rect) {
  return !(
    left.x + left.width < right.x ||
    right.x + right.width < left.x ||
    left.y + left.height < right.y ||
    right.y + right.height < left.y
  );
}

function containsPoint(rect: Rect, point: Point) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}
