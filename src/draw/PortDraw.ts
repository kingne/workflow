import { GroupDraw } from "./GroupDraw.ts";
import { ShapeDraw } from "./ShapeDraw.ts";
import { TextDraw } from "./TextDraw.ts";
import type { Point, WorkflowPortDirection, WorkflowPortModel } from "../types.ts";
import { getPortTypeColor } from "../workflow/connection.ts";

type PortLayout = {
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  typeX: number;
  typeY: number;
  maxLabelWidth: number;
  labelAlign?: CanvasTextAlign;
  typeAlign?: CanvasTextAlign;
};

const PORT_RADIUS = 6;
type PortConnectionState = "idle" | "source" | "valid-target" | "invalid-target";

export class PortDraw extends GroupDraw {
  private isHovered = false;
  private connectionState: PortConnectionState = "idle";
  private anchor: Point = { x: 0, y: 0 };
  private circleDraw: ShapeDraw;
  private innerDotDraw: ShapeDraw;
  private labelDraw: TextDraw;
  private typeDraw: TextDraw;

  constructor(
    private port: WorkflowPortModel,
    private direction: WorkflowPortDirection,
  ) {
    const circleDraw = new ShapeDraw(
      {
        kind: "circle",
        x: 0,
        y: 0,
        radius: PORT_RADIUS,
      },
      {
        fillStyle: "#ffffff",
        strokeStyle: getPortTypeColor(port.dataType),
        lineWidth: 2,
      },
    );

    const innerDotDraw = new ShapeDraw(
      {
        kind: "circle",
        x: 0,
        y: 0,
        radius: 2.5,
      },
      {
        fillStyle: getPortTypeColor(port.dataType),
      },
    );

    const labelDraw = new TextDraw({
      text: port.label,
      x: 0,
      y: 0,
      font: "600 12px sans-serif",
      fillStyle: "#0f172a",
      textBaseline: "middle",
      textAlign: direction === "input" ? "left" : "right",
    });

    const typeDraw = new TextDraw({
      text: port.dataType,
      x: 0,
      y: 0,
      font: "500 11px ui-monospace, SFMono-Regular, Menlo, monospace",
      fillStyle: getPortTypeColor(port.dataType),
      textBaseline: "middle",
      textAlign: direction === "input" ? "left" : "right",
    });

    super([circleDraw, innerDotDraw, labelDraw, typeDraw]);
    this.circleDraw = circleDraw;
    this.innerDotDraw = innerDotDraw;
    this.labelDraw = labelDraw;
    this.typeDraw = typeDraw;
  }

  getPort() {
    return this.port;
  }

  getDirection() {
    return this.direction;
  }

  getAnchor() {
    return { ...this.anchor };
  }

  setHovered(isHovered: boolean) {
    this.isHovered = isHovered;
    this.syncStyle();
  }

  setConnectionState(connectionState: PortConnectionState) {
    this.connectionState = connectionState;
    this.syncStyle();
  }

  updateLayout(layout: PortLayout) {
    this.anchor = {
      x: layout.anchorX,
      y: layout.anchorY,
    };

    this.circleDraw.setGeometry({
      kind: "circle",
      x: layout.anchorX,
      y: layout.anchorY,
      radius: PORT_RADIUS,
    });
    this.innerDotDraw.setGeometry({
      kind: "circle",
      x: layout.anchorX,
      y: layout.anchorY,
      radius: 2.5,
    });
    this.labelDraw.update({
      x: layout.labelX,
      y: layout.labelY,
      maxWidth: layout.maxLabelWidth,
      textAlign: layout.labelAlign,
    });
    this.typeDraw.update({
      x: layout.typeX,
      y: layout.typeY,
      maxWidth: layout.maxLabelWidth,
      textAlign: layout.typeAlign,
    });

    this.syncStyle();
  }

  override hitTest(point: Point) {
    const distance = Math.hypot(point.x - this.anchor.x, point.y - this.anchor.y);
    return distance <= PORT_RADIUS + 10;
  }

  private syncStyle() {
    const color = getPortTypeColor(this.port.dataType);
    const feedbackColor =
      this.connectionState === "valid-target"
        ? "#16a34a"
        : this.connectionState === "invalid-target"
          ? "#dc2626"
          : this.connectionState === "source"
            ? color
            : null;
    const activeColor = feedbackColor ?? color;
    const isActive = this.isHovered || this.connectionState !== "idle";
    const fillStyle =
      this.connectionState === "invalid-target"
        ? "#fff5f5"
        : isActive
          ? activeColor
          : "#ffffff";
    const innerFillStyle =
      this.connectionState === "invalid-target" ? activeColor : isActive ? "#ffffff" : activeColor;
    const labelColor = feedbackColor ?? (this.isHovered ? color : "#0f172a");

    this.circleDraw.setStyle({
      fillStyle,
      strokeStyle: activeColor,
      lineWidth: this.connectionState === "source" ? 2.5 : 2,
      shadowColor: isActive ? `${activeColor}55` : "transparent",
      shadowBlur: isActive ? 10 : 0,
    });
    this.innerDotDraw.setStyle({
      fillStyle: innerFillStyle,
    });
    this.labelDraw.update({
      fillStyle: labelColor,
    });
    this.typeDraw.update({
      fillStyle: feedbackColor ?? color,
    });
  }
}
