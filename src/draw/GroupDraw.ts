import { Draw } from "./Draw.ts";
import type { Point } from "../types.ts";

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

  protected onDraw(context: CanvasRenderingContext2D) {
    this.children.forEach((child) => child.draw(context));
  }

  override hitTest(point: Point) {
    return this.findTarget(point) !== null;
  }

  override findTarget(point: Point): Draw | null {
    if (!this.visible) {
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
