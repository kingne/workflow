import { GroupDraw } from "./GroupDraw.ts";
import { LineDraw } from "./LineDraw.ts";
import { ShapeDraw } from "./ShapeDraw.ts";
import type { Point } from "../types.ts";
import type { Draw } from "./Draw.ts";

export class ConnectionPreviewDraw extends GroupDraw {
  private lineDraw: LineDraw;
  private arrowDraw: ShapeDraw;

  constructor() {
    const lineDraw = new LineDraw(
      {
        kind: "bezier",
        start: { x: 0, y: 0 },
        control1: { x: 0, y: 0 },
        control2: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
      },
      {
        strokeStyle: "#2563eb",
        lineWidth: 3,
        lineCap: "round",
        dash: [8, 6],
        globalAlpha: 0.9,
      },
    );

    const arrowDraw = new ShapeDraw(
      {
        kind: "polygon",
        points: [],
      },
      {
        fillStyle: "#2563eb",
      },
    );

    super([lineDraw, arrowDraw]);
    this.lineDraw = lineDraw;
    this.arrowDraw = arrowDraw;
    this.visible = false;
  }

  setPreview(start: Point, end: Point, color: string) {
    const controlOffset = Math.max(64, Math.abs(end.x - start.x) * 0.5);
    const control1 = { x: start.x + controlOffset, y: start.y };
    const control2 = { x: end.x - controlOffset, y: end.y };
    const tangentX = end.x - control2.x;
    const tangentY = end.y - control2.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const unitX = tangentX / tangentLength;
    const unitY = tangentY / tangentLength;
    const normalX = -unitY;
    const normalY = unitX;
    const arrowLength = 12;
    const arrowWidth = 6;

    this.visible = true;
    this.lineDraw.setGeometry({
      kind: "bezier",
      start,
      control1,
      control2,
      end,
    });
    this.lineDraw.setStyle({
      strokeStyle: color,
    });
    this.arrowDraw.setGeometry({
      kind: "polygon",
      points: [
        end,
        {
          x: end.x - unitX * arrowLength + normalX * arrowWidth,
          y: end.y - unitY * arrowLength + normalY * arrowWidth,
        },
        {
          x: end.x - unitX * arrowLength - normalX * arrowWidth,
          y: end.y - unitY * arrowLength - normalY * arrowWidth,
        },
      ],
    });
    this.arrowDraw.setStyle({
      fillStyle: color,
    });
  }

  clear() {
    this.visible = false;
  }

  override hitTest() {
    return false;
  }

  override findTarget(_point: Point): Draw | null {
    return null;
  }
}
