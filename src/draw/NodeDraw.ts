import type { Draw } from "./Draw.ts";
import { GroupDraw } from "./GroupDraw.ts";
import { LineDraw } from "./LineDraw.ts";
import { PortDraw } from "./PortDraw.ts";
import { RunningBorderDraw } from "./RunningBorderDraw.ts";
import { ShapeDraw } from "./ShapeDraw.ts";
import { TableDraw, type TableRowDraw } from "./TableDraw.ts";
import { TextDraw } from "./TextDraw.ts";
import type { Point, Rect, WorkflowNodeModel } from "../types.ts";
import { getInputPort, getOutputPort } from "../workflow/connection.ts";

const HEADER_HEIGHT = 58;
const FOOTER_HEIGHT = 42;
const CARD_RADIUS = 18;
const CARD_PADDING = 16;
const CONTENT_INSET = 12;
const ACTION_BUTTON_WIDTH = 64;
const ACTION_BUTTON_HEIGHT = 30;
const PORT_ROW_HEIGHT = 38;
const PORT_OUTSIDE_OFFSET = 6;
const PORT_LABEL_WIDTH = 120;

export type NodeEventItemDetail =
  | { item: "node" }
  | { item: "header" }
  | { item: "action-button" }
  | { item: "content" }
  | { item: "footer" }
  | { item: "table" }
  | { item: "table-row"; rowIndex: number; rowLabel: string; rowValue: string }
  | {
      item: "input-port" | "output-port";
      portId: string;
      portLabel: string;
      dataType: string;
    };

export class NodeDraw extends GroupDraw {
  private isDragging = false;
  private isHovered = false;
  private isSelected = false;
  private isHeaderHovered = false;
  private isActionHovered = false;
  private layoutHeight = 0;
  private bodyDraw: ShapeDraw;
  private runningBorderDraw: RunningBorderDraw;
  private headerGroup: GroupDraw;
  private headerBackgroundDraw: ShapeDraw;
  private logoDraw: ShapeDraw;
  private logoTextDraw: TextDraw;
  private titleDraw: TextDraw;
  private dragHintDraw: TextDraw;
  private headerDividerDraw: LineDraw;
  private actionButtonGroup: GroupDraw;
  private actionButtonDraw: ShapeDraw;
  private actionButtonTextDraw: TextDraw;
  private contentGroup: GroupDraw;
  private contentBackgroundDraw: ShapeDraw;
  private tableDraw: TableDraw;
  private footerGroup: GroupDraw;
  private footerBackgroundDraw: ShapeDraw;
  private footerDividerDraw: LineDraw;
  private footerStatusDotDraw: ShapeDraw;
  private footerStatusTextDraw: TextDraw;
  private footerErrorTextDraw: TextDraw;
  private inputPortDraws: PortDraw[];
  private outputPortDraws: PortDraw[];
  private inputPortSignature = "";
  private outputPortSignature = "";

  constructor(public model: WorkflowNodeModel) {
    const bodyDraw = new ShapeDraw(
      {
        kind: "rect",
        x: model.x,
        y: model.y,
        width: model.width,
        height: model.height,
        radius: CARD_RADIUS,
      },
      {
        fillStyle: "#ffffff",
      },
    );
    const runningBorderDraw = new RunningBorderDraw();

    const headerBackgroundDraw = new ShapeDraw(
      {
        kind: "rect",
        x: model.x + 1,
        y: model.y + 1,
        width: model.width - 2,
        height: HEADER_HEIGHT,
        radius: CARD_RADIUS - 1,
      },
      {
        fillStyle: "#f8fbff",
      },
    );

    const logoDraw = new ShapeDraw(
      {
        kind: "circle",
        x: 0,
        y: 0,
        radius: 14,
      },
      {
        fillStyle: model.color,
      },
    );

    const logoTextDraw = new TextDraw({
      text: model.logoText,
      x: 0,
      y: 0,
      font: "700 11px sans-serif",
      fillStyle: "#ffffff",
      textAlign: "center",
      textBaseline: "middle",
    });

    const titleDraw = new TextDraw({
      text: model.title,
      x: 0,
      y: 0,
      font: "600 14px sans-serif",
      fillStyle: "#0f172a",
      textBaseline: "middle",
    });

    const dragHintDraw = new TextDraw({
      text: "Drag",
      x: 0,
      y: 0,
      font: "600 11px sans-serif",
      fillStyle: "rgba(37, 99, 235, 0.8)",
      textBaseline: "middle",
    });

    const headerDividerDraw = new LineDraw(
      {
        kind: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      },
      {
        strokeStyle: "rgba(148, 163, 184, 0.18)",
        lineWidth: 1,
      },
    );

    const actionButtonDraw = new ShapeDraw(
      {
        kind: "rect",
        x: 0,
        y: 0,
        width: ACTION_BUTTON_WIDTH,
        height: ACTION_BUTTON_HEIGHT,
        radius: 12,
      },
      {
        fillStyle: "#ffffff",
        strokeStyle: "rgba(148, 163, 184, 0.28)",
        lineWidth: 1,
      },
    );

    const actionButtonTextDraw = new TextDraw({
      text: model.actionLabel,
      x: 0,
      y: 0,
      font: "600 12px sans-serif",
      fillStyle: "#0f172a",
      textAlign: "center",
      textBaseline: "middle",
    });

    const actionButtonGroup = new GroupDraw([actionButtonDraw, actionButtonTextDraw]);
    const headerGroup = new GroupDraw([
      headerBackgroundDraw,
      logoDraw,
      logoTextDraw,
      titleDraw,
      dragHintDraw,
      actionButtonGroup,
      headerDividerDraw,
    ]);

    const contentBackgroundDraw = new ShapeDraw(
      {
        kind: "rect",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        radius: 16,
      },
      {
        fillStyle: "#f8fafc",
        strokeStyle: "rgba(148, 163, 184, 0.18)",
        lineWidth: 1,
      },
    );

    const tableDraw = new TableDraw({
      x: 0,
      y: 0,
      width: 0,
      rows: model.parameters,
      title: "Config",
    });

    const inputPortDraws = model.inputs.map((port) => createNodePortDraw(port, "input"));
    const outputPortDraws = model.outputs.map((port) => createNodePortDraw(port, "output"));
    const contentGroup = new GroupDraw([
      contentBackgroundDraw,
      ...inputPortDraws,
      tableDraw,
      ...outputPortDraws,
    ]);

    const footerBackgroundDraw = new ShapeDraw(
      {
        kind: "rect",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        radius: 12,
      },
      {
        fillStyle: "rgba(255, 255, 255, 0.001)",
      },
    );

    const footerDividerDraw = new LineDraw(
      {
        kind: "polyline",
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      },
      {
        strokeStyle: "rgba(148, 163, 184, 0.18)",
        lineWidth: 1,
      },
    );

    const footerStatusDotDraw = new ShapeDraw(
      {
        kind: "circle",
        x: 0,
        y: 0,
        radius: 4,
      },
      {
        fillStyle: "#94a3b8",
      },
    );

    const footerStatusTextDraw = new TextDraw({
      text: model.statusLabel,
      x: 0,
      y: 0,
      font: "600 12px sans-serif",
      fillStyle: "#0f172a",
      textBaseline: "middle",
    });

    const footerErrorTextDraw = new TextDraw({
      text: model.errorText,
      x: 0,
      y: 0,
      font: "500 12px sans-serif",
      fillStyle: "rgba(220, 38, 38, 0.95)",
      textAlign: "right",
      textBaseline: "middle",
      maxWidth: 180,
    });

    const footerGroup = new GroupDraw([
      footerBackgroundDraw,
      footerDividerDraw,
      footerStatusDotDraw,
      footerStatusTextDraw,
      footerErrorTextDraw,
    ]);

    super([bodyDraw, headerGroup, contentGroup, footerGroup, runningBorderDraw]);

    this.bodyDraw = bodyDraw;
    this.runningBorderDraw = runningBorderDraw;
    this.headerGroup = headerGroup;
    this.headerBackgroundDraw = headerBackgroundDraw;
    this.logoDraw = logoDraw;
    this.logoTextDraw = logoTextDraw;
    this.titleDraw = titleDraw;
    this.dragHintDraw = dragHintDraw;
    this.headerDividerDraw = headerDividerDraw;
    this.actionButtonGroup = actionButtonGroup;
    this.actionButtonDraw = actionButtonDraw;
    this.actionButtonTextDraw = actionButtonTextDraw;
    this.contentGroup = contentGroup;
    this.contentBackgroundDraw = contentBackgroundDraw;
    this.tableDraw = tableDraw;
    this.footerGroup = footerGroup;
    this.footerBackgroundDraw = footerBackgroundDraw;
    this.footerDividerDraw = footerDividerDraw;
    this.footerStatusDotDraw = footerStatusDotDraw;
    this.footerStatusTextDraw = footerStatusTextDraw;
    this.footerErrorTextDraw = footerErrorTextDraw;
    this.inputPortDraws = inputPortDraws;
    this.outputPortDraws = outputPortDraws;
    this.inputPortSignature = getPortSignature(model.inputs);
    this.outputPortSignature = getPortSignature(model.outputs);

    this.headerGroup
      .onMouseEnter(() => {
        this.isHeaderHovered = true;
        this.syncFromModel();
      })
      .onMouseLeave(() => {
        this.isHeaderHovered = false;
        this.syncFromModel();
      });

    this.actionButtonGroup
      .onMouseEnter(() => {
        this.isActionHovered = true;
        this.syncFromModel();
      })
      .onMouseLeave(() => {
        this.isActionHovered = false;
        this.syncFromModel();
      });

    this.syncFromModel();
  }

  getHeight() {
    return this.layoutHeight;
  }

  moveTo(x: number, y: number) {
    this.model.x = x;
    this.model.y = y;
    this.syncFromModel();
  }

  setDragging(isDragging: boolean) {
    this.isDragging = isDragging;
    this.syncFromModel();
  }

  setHovered(isHovered: boolean) {
    this.isHovered = isHovered;
    this.syncFromModel();
  }

  setSelected(isSelected: boolean) {
    this.isSelected = isSelected;
    this.syncFromModel();
  }

  isRunning() {
    return this.model.statusTone === "running";
  }

  isDraggableTarget(target: Draw | null) {
    return this.isDrawInside(target, this.headerGroup) && !this.isDrawInside(target, this.actionButtonGroup);
  }

  getActionButtonDraw() {
    return this.actionButtonGroup;
  }

  getContentDraw() {
    return this.contentGroup;
  }

  getTableDraw() {
    return this.tableDraw;
  }

  getFooterDraw() {
    return this.footerGroup;
  }

  getInputPort(portId: string) {
    return getInputPort(this.model, portId);
  }

  getOutputPort(portId: string) {
    return getOutputPort(this.model, portId);
  }

  getInputPortAnchor(portId: string) {
    return this.inputPortDraws.find((portDraw) => portDraw.getPort().id === portId)?.getAnchor() ?? null;
  }

  getOutputPortAnchor(portId: string) {
    return this.outputPortDraws.find((portDraw) => portDraw.getPort().id === portId)?.getAnchor() ?? null;
  }

  getPortDraws() {
    return [...this.inputPortDraws, ...this.outputPortDraws];
  }

  resolveEventItem(target: Draw | null): NodeEventItemDetail {
    const rowDraw = this.tableDraw.resolveRowDraw(target);

    if (rowDraw) {
      return getTableRowDetail(rowDraw);
    }

    const inputPortDraw = this.inputPortDraws.find((portDraw) => this.isDrawInside(target, portDraw));

    if (inputPortDraw) {
      const port = inputPortDraw.getPort();
      return {
        item: "input-port",
        portId: port.id,
        portLabel: port.label,
        dataType: port.dataType,
      };
    }

    const outputPortDraw = this.outputPortDraws.find((portDraw) => this.isDrawInside(target, portDraw));

    if (outputPortDraw) {
      const port = outputPortDraw.getPort();
      return {
        item: "output-port",
        portId: port.id,
        portLabel: port.label,
        dataType: port.dataType,
      };
    }

    if (this.isDrawInside(target, this.actionButtonGroup)) {
      return { item: "action-button" };
    }

    if (this.isDrawInside(target, this.headerGroup)) {
      return { item: "header" };
    }

    if (this.isDrawInside(target, this.tableDraw)) {
      return { item: "table" };
    }

    if (this.isDrawInside(target, this.footerGroup)) {
      return { item: "footer" };
    }

    if (this.isDrawInside(target, this.contentGroup)) {
      return { item: "content" };
    }

    return { item: "node" };
  }

  getInputAnchor() {
    const firstPort = this.inputPortDraws[0];
    return firstPort?.getAnchor() ?? { x: this.model.x, y: this.model.y + this.layoutHeight / 2 };
  }

  getOutputAnchor() {
    const firstPort = this.outputPortDraws[0];
    return firstPort?.getAnchor() ?? { x: this.model.x + this.model.width, y: this.model.y + this.layoutHeight / 2 };
  }

  syncFromModel() {
    this.syncPortDrawsFromModel();

    const { x, y, width } = this.model;
    const portSectionHeight =
      Math.max(this.model.inputs.length, this.model.outputs.length, 1) * PORT_ROW_HEIGHT + 18;
    const minimumContentHeight = Math.max(this.tableDraw.getHeight() + CONTENT_INSET * 2, portSectionHeight + 24);
    const minimumHeight = HEADER_HEIGHT + FOOTER_HEIGHT + minimumContentHeight + 24;
    const height = Math.max(this.model.height, minimumHeight);
    this.layoutHeight = height;

    const headerCenterY = y + HEADER_HEIGHT / 2;
    const actionX = x + width - CARD_PADDING - ACTION_BUTTON_WIDTH;
    const actionY = y + (HEADER_HEIGHT - ACTION_BUTTON_HEIGHT) / 2;
    const contentX = x + CARD_PADDING;
    const contentY = y + HEADER_HEIGHT + 12;
    const footerY = y + height - FOOTER_HEIGHT;
    const contentWidth = width - CARD_PADDING * 2;
    const contentHeight = footerY - contentY - 12;
    const dragHintVisible = this.isHeaderHovered && !this.isActionHovered;
    const tableX = contentX + CONTENT_INSET;
    const tableWidth = Math.max(150, contentWidth - CONTENT_INSET * 2);
    const inputAnchorX = x - PORT_OUTSIDE_OFFSET;
    const outputAnchorX = x + width + PORT_OUTSIDE_OFFSET;

    this.bodyDraw.setGeometry({
      kind: "rect",
      x,
      y,
      width,
      height,
      radius: CARD_RADIUS,
    });
    this.bodyDraw.setStyle({
      fillStyle: "#ffffff",
      strokeStyle: this.isSelected
        ? "rgba(37, 99, 235, 0.9)"
        : this.isHovered
          ? "rgba(37, 99, 235, 0.26)"
          : "rgba(148, 163, 184, 0.12)",
      lineWidth: this.isSelected ? 2.5 : this.isHovered ? 2 : 1,
      shadowColor: "rgba(15, 23, 42, 0.12)",
      shadowBlur: this.isDragging ? 30 : this.isSelected ? 24 : this.isHovered ? 22 : 18,
      shadowOffsetY: this.isDragging ? 16 : this.isSelected ? 14 : this.isHovered ? 12 : 10,
    });
    this.runningBorderDraw.setGeometry({
      x: x - 1.5,
      y: y - 1.5,
      width: width + 3,
      height,
      radius: CARD_RADIUS + 1.5,
    });
    this.runningBorderDraw.setColor(this.model.color);
    this.runningBorderDraw.setActive(this.isRunning());

    this.headerBackgroundDraw.setGeometry({
      kind: "rect",
      x: x + 1,
      y: y + 1,
      width: width - 2,
      height: HEADER_HEIGHT,
      radius: CARD_RADIUS - 1,
    });
    this.headerBackgroundDraw.setStyle({
      fillStyle: dragHintVisible ? "rgba(239, 246, 255, 0.96)" : "rgba(248, 250, 252, 0.96)",
    });

    this.logoDraw.setGeometry({
      kind: "circle",
      x: x + CARD_PADDING + 14,
      y: headerCenterY,
      radius: 14,
    });
    this.logoDraw.setStyle({
      fillStyle: this.model.color,
    });

    this.logoTextDraw.update({
      text: this.model.logoText,
      x: x + CARD_PADDING + 14,
      y: headerCenterY,
    });

    this.titleDraw.update({
      text: this.model.title,
      x: x + CARD_PADDING + 38,
      y: headerCenterY,
      fillStyle: dragHintVisible ? "#1d4ed8" : "#0f172a",
      maxWidth: width - CARD_PADDING * 2 - ACTION_BUTTON_WIDTH - 76,
    });

    this.dragHintDraw.visible = dragHintVisible;
    this.dragHintDraw.update({
      x: actionX - 16,
      y: headerCenterY,
      textAlign: "right",
    });

    this.actionButtonDraw.setGeometry({
      kind: "rect",
      x: actionX,
      y: actionY,
      width: ACTION_BUTTON_WIDTH,
      height: ACTION_BUTTON_HEIGHT,
      radius: 12,
    });
    this.actionButtonDraw.setStyle({
      fillStyle: this.isActionHovered ? "#0f172a" : "#ffffff",
      strokeStyle: this.isActionHovered ? "#0f172a" : "rgba(148, 163, 184, 0.28)",
      lineWidth: 1,
    });

    this.actionButtonTextDraw.update({
      text: this.model.actionLabel,
      x: actionX + ACTION_BUTTON_WIDTH / 2,
      y: actionY + ACTION_BUTTON_HEIGHT / 2,
      fillStyle: this.isActionHovered ? "#ffffff" : "#0f172a",
    });

    this.headerDividerDraw.setGeometry({
      kind: "polyline",
      points: [
        { x: x + 14, y: y + HEADER_HEIGHT },
        { x: x + width - 14, y: y + HEADER_HEIGHT },
      ],
    });

    this.contentBackgroundDraw.setGeometry({
      kind: "rect",
      x: contentX,
      y: contentY,
      width: contentWidth,
      height: contentHeight,
      radius: 16,
    });
    this.contentBackgroundDraw.setStyle({
      fillStyle: "#f8fafc",
      strokeStyle: "rgba(148, 163, 184, 0.16)",
      lineWidth: 1,
    });

    this.tableDraw.update({
      x: tableX,
      y: contentY + 12,
      width: tableWidth,
      rows: this.model.parameters,
      title: "Config",
    });

    this.layoutPorts(
      this.inputPortDraws,
      inputAnchorX,
      contentY + 24,
      contentHeight,
      "input",
    );
    this.layoutPorts(
      this.outputPortDraws,
      outputAnchorX,
      contentY + 24,
      contentHeight,
      "output",
    );

    this.footerDividerDraw.setGeometry({
      kind: "polyline",
      points: [
        { x: x + 14, y: footerY },
        { x: x + width - 14, y: footerY },
      ],
    });

    const footerCenterY = footerY + FOOTER_HEIGHT / 2 + 1;
    this.footerBackgroundDraw.setGeometry({
      kind: "rect",
      x: x + CARD_PADDING,
      y: footerY,
      width: width - CARD_PADDING * 2,
      height: FOOTER_HEIGHT,
      radius: 12,
    });

    this.footerStatusDotDraw.setGeometry({
      kind: "circle",
      x: x + CARD_PADDING + 4,
      y: footerCenterY,
      radius: 4,
    });
    this.footerStatusDotDraw.setStyle({
      fillStyle: getStatusColor(this.model.statusTone),
    });

    this.footerStatusTextDraw.update({
      text: this.model.statusLabel,
      x: x + CARD_PADDING + 16,
      y: footerCenterY,
      fillStyle: getStatusColor(this.model.statusTone),
    });

    this.footerErrorTextDraw.update({
      text: this.model.errorText,
      x: x + width - CARD_PADDING,
      y: footerCenterY,
      fillStyle: this.model.statusTone === "error" ? "#dc2626" : "rgba(100, 116, 139, 0.9)",
      maxWidth: width - 150,
    });
  }

  override hitTest(point: Point) {
    return (
      point.x >= this.model.x &&
      point.x <= this.model.x + this.model.width &&
      point.y >= this.model.y &&
      point.y <= this.model.y + this.layoutHeight
    );
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

  override getBounds(): Rect {
    return {
      x: this.model.x,
      y: this.model.y,
      width: this.model.width,
      height: this.layoutHeight,
    };
  }

  private layoutPorts(
    portDraws: PortDraw[],
    anchorX: number,
    contentTopY: number,
    contentHeight: number,
    side: "input" | "output",
  ) {
    if (portDraws.length === 0) {
      return;
    }

    const totalHeight = (portDraws.length - 1) * PORT_ROW_HEIGHT;
    const startY = contentTopY + Math.max(16, (contentHeight - totalHeight) / 2 - 18);

    portDraws.forEach((portDraw, index) => {
      const anchorY = startY + index * PORT_ROW_HEIGHT;
      const labelX = side === "input" ? anchorX - 14 : anchorX + 14;
      const typeX = labelX;

      portDraw.updateLayout({
        anchorX,
        anchorY,
        labelX,
        labelY: anchorY - 7,
        typeX,
        typeY: anchorY + 8,
        maxLabelWidth: PORT_LABEL_WIDTH,
        labelAlign: side === "input" ? "right" : "left",
        typeAlign: side === "input" ? "right" : "left",
      });
    });
  }

  private isDrawInside(target: Draw | null, container: Draw) {
    let current = target;

    while (current) {
      if (current === container) {
        return true;
      }

      current = current.parent;
    }

    return false;
  }

  private syncPortDrawsFromModel() {
    const nextInputSignature = getPortSignature(this.model.inputs);
    const nextOutputSignature = getPortSignature(this.model.outputs);

    if (
      nextInputSignature === this.inputPortSignature &&
      nextOutputSignature === this.outputPortSignature
    ) {
      return;
    }

    this.inputPortDraws = this.model.inputs.map((port) => createNodePortDraw(port, "input"));
    this.outputPortDraws = this.model.outputs.map((port) => createNodePortDraw(port, "output"));
    this.inputPortSignature = nextInputSignature;
    this.outputPortSignature = nextOutputSignature;
    this.contentGroup.setChildren([
      this.contentBackgroundDraw,
      ...this.inputPortDraws,
      this.tableDraw,
      ...this.outputPortDraws,
    ]);
  }
}

function getPortSignature(ports: WorkflowNodeModel["inputs"]) {
  return ports
    .map((port) => `${port.id}:${port.label}:${port.dataType}:${port.description ?? ""}`)
    .join("|");
}

function createNodePortDraw(
  port: WorkflowNodeModel["inputs"][number],
  direction: "input" | "output",
) {
  const portDraw = new PortDraw(port, direction);

  portDraw
    .onMouseEnter(() => {
      portDraw.setHovered(true);
    })
    .onMouseLeave(() => {
      portDraw.setHovered(false);
    });

  return portDraw;
}

function getTableRowDetail(rowDraw: TableRowDraw): NodeEventItemDetail {
  const row = rowDraw.getRow();

  return {
    item: "table-row",
    rowIndex: rowDraw.getIndex(),
    rowLabel: row.label,
    rowValue: row.value,
  };
}

function getStatusColor(statusTone: WorkflowNodeModel["statusTone"]) {
  switch (statusTone) {
    case "running":
      return "#2563eb";
    case "success":
      return "#16a34a";
    case "error":
      return "#dc2626";
    default:
      return "#64748b";
  }
}
