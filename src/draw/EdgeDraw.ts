import { GroupDraw } from "./GroupDraw.ts";
import { LineDraw } from "./LineDraw.ts";
import { RunningEdgeFlowDraw } from "./RunningEdgeFlowDraw.ts";
import { ShapeDraw } from "./ShapeDraw.ts";
import type { Point, Rect, WorkflowEdgeModel } from "../types.ts";
import type { NodeDraw } from "./NodeDraw.ts";
import { getPortTypeColor, validateEdgeConnection } from "../workflow/connection.ts";

export class EdgeDraw extends GroupDraw {
  private isHovered = false;
  private isSelected = false;
  private isRunning = false;
  private pathPoints: Point[] = [];
  private lineDraw: LineDraw;
  private runningFlowDraw: RunningEdgeFlowDraw;
  private arrowDraw: ShapeDraw;

  constructor(
    public model: WorkflowEdgeModel,
    private getNodeById: (id: string) => NodeDraw | null,
  ) {
    const lineDraw = new LineDraw(
      {
        kind: "bezier",
        start: { x: 0, y: 0 },
        control1: { x: 0, y: 0 },
        control2: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
      },
      {
        strokeStyle: "#475569",
        lineWidth: 3,
        lineCap: "round",
      },
    );
    const runningFlowDraw = new RunningEdgeFlowDraw();

    const arrowDraw = new ShapeDraw(
      {
        kind: "polygon",
        points: [],
      },
      {
        fillStyle: "#475569",
      },
    );

    super([lineDraw, runningFlowDraw, arrowDraw]);
    this.lineDraw = lineDraw;
    this.runningFlowDraw = runningFlowDraw;
    this.arrowDraw = arrowDraw;
    this.refresh();
  }

  refresh() {
    const validation = validateEdgeConnection(this.model, (id) => this.getNodeById(id)?.model ?? null);
    const fromNode = this.getNodeById(this.model.fromNodeId);
    const toNode = this.getNodeById(this.model.toNodeId);

    if (!fromNode || !toNode || !validation.ok) {
      this.visible = false;
      return;
    }

    this.visible = true;

    const start = fromNode.getOutputPortAnchor(this.model.fromPortId);
    const end = toNode.getInputPortAnchor(this.model.toPortId);

    if (!start || !end) {
      this.visible = false;
      return;
    }

    this.isRunning = fromNode.model.statusTone === "running";

    const controlOffset = Math.max(64, (end.x - start.x) * 0.5);
    const control1 = { x: start.x + controlOffset, y: start.y };
    const control2 = { x: end.x - controlOffset, y: end.y };

    this.lineDraw.setGeometry({
      kind: "bezier",
      start,
      control1,
      control2,
      end,
    });
    this.runningFlowDraw.setGeometry({
      start,
      control1,
      control2,
      end,
    });

    const tangentX = end.x - control2.x;
    const tangentY = end.y - control2.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const unitX = tangentX / tangentLength;
    const unitY = tangentY / tangentLength;
    const normalX = -unitY;
    const normalY = unitX;
    const arrowLength = 12;
    const arrowWidth = 6;

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

    const edgeColor = getPortTypeColor(validation.sourcePort.dataType);
    const baseLineWidth = this.isSelected ? 5 : this.isHovered ? 4 : 3;
    this.lineDraw.setStyle({
      strokeStyle: this.isRunning ? `${edgeColor}66` : edgeColor,
      lineWidth: baseLineWidth,
    });
    this.runningFlowDraw.setColor(edgeColor);
    this.runningFlowDraw.setLineWidth(baseLineWidth);
    this.runningFlowDraw.setActive(this.isRunning);
    this.arrowDraw.setStyle({
      fillStyle: edgeColor,
      shadowColor: this.isRunning ? `${edgeColor}66` : "transparent",
      shadowBlur: this.isRunning ? 10 : 0,
    });

    this.pathPoints = [start, control1, control2, end];
  }

  setHovered(isHovered: boolean) {
    this.isHovered = isHovered;
    this.refresh();
  }

  setSelected(isSelected: boolean) {
    this.isSelected = isSelected;
    this.refresh();
  }

  isAnimating() {
    return this.isRunning;
  }

  intersectsRect(rect: Rect) {
    const bounds = this.getBounds();

    return !(
      rect.x + rect.width < bounds.x ||
      rect.x > bounds.x + bounds.width ||
      rect.y + rect.height < bounds.y ||
      rect.y > bounds.y + bounds.height
    );
  }

  getBounds(): Rect {
    if (this.pathPoints.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const xs = this.pathPoints.map((point) => point.x);
    const ys = this.pathPoints.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padding = this.isSelected ? 10 : 6;

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }
}
