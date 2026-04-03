import { GroupDraw } from "./GroupDraw.ts";
import type { Draw } from "./Draw.ts";
import type { DrawMouseEvent } from "./Draw.ts";
import { LineDraw } from "./LineDraw.ts";
import { ShapeDraw } from "./ShapeDraw.ts";
import { TextDraw } from "./TextDraw.ts";
import type { Point, Rect } from "../types.ts";
import type { WorkflowTableRow } from "../types.ts";

type TableDrawOptions = {
  x: number;
  y: number;
  width: number;
  rows: WorkflowTableRow[];
  title?: string;
  rowHeight?: number;
};

export class TableDraw extends GroupDraw {
  private options: TableDrawOptions;
  private titleDraw: TextDraw | null = null;
  private frameDraw: ShapeDraw;
  private rowDraws: TableRowDraw[] = [];
  private rowClickHandlers: TableRowHandler[] = [];
  private rowMouseEnterHandlers: TableRowHandler[] = [];
  private rowMouseLeaveHandlers: TableRowHandler[] = [];

  constructor(options: TableDrawOptions) {
    const frameDraw = new ShapeDraw(
      {
        kind: "rect",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        radius: 14,
      },
      {
        fillStyle: "#ffffff",
        strokeStyle: "rgba(148, 163, 184, 0.18)",
        lineWidth: 1,
      },
    );
    super([frameDraw]);
    this.options = options;
    this.frameDraw = frameDraw;
    this.sync();
  }

  update(options: Partial<TableDrawOptions>) {
    this.options = { ...this.options, ...options };
    this.sync();
  }

  getHeight() {
    const titleHeight = this.options.title ? 24 : 0;
    const rowHeight = this.options.rowHeight ?? 34;
    return titleHeight + this.options.rows.length * rowHeight + 18;
  }

  override getBounds(): Rect {
    const { x, y, width } = this.options;

    return {
      x,
      y,
      width,
      height: this.getHeight(),
    };
  }

  getRowDraw(index: number) {
    return this.rowDraws[index] ?? null;
  }

  getRowDraws() {
    return [...this.rowDraws];
  }

  resolveRowDraw(target: Draw | null) {
    let current = target;

    while (current) {
      const rowDraw = this.rowDraws.find((candidate) => candidate === current);

      if (rowDraw) {
        return rowDraw;
      }

      if (current === this) {
        break;
      }

      current = current.parent;
    }

    return null;
  }

  onRowClick(handler: TableRowHandler) {
    this.rowClickHandlers.push(handler);
    this.rowDraws.forEach((rowDraw) => {
      rowDraw.onClick((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });
    return this;
  }

  onRowMouseEnter(handler: TableRowHandler) {
    this.rowMouseEnterHandlers.push(handler);
    this.rowDraws.forEach((rowDraw) => {
      rowDraw.onMouseEnter((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });
    return this;
  }

  onRowMouseLeave(handler: TableRowHandler) {
    this.rowMouseLeaveHandlers.push(handler);
    this.rowDraws.forEach((rowDraw) => {
      rowDraw.onMouseLeave((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });
    return this;
  }

  private sync() {
    const { x, y, width, rows, title, rowHeight = 34 } = this.options;
    const titleHeight = title ? 24 : 0;
    const tableY = y + titleHeight;
    const tableHeight = rows.length * rowHeight;

    if (title) {
      if (!this.titleDraw) {
        this.titleDraw = new TextDraw({
          text: title,
          x,
          y,
          font: "600 12px sans-serif",
          fillStyle: "rgba(71, 85, 105, 0.8)",
          textBaseline: "top",
        });
      } else {
        this.titleDraw.update({
          text: title,
          x,
          y,
        });
      }
    } else {
      this.titleDraw = null;
    }

    this.frameDraw.setGeometry({
      kind: "rect",
      x,
      y: tableY,
      width,
      height: tableHeight,
      radius: 14,
    });

    this.rowDraws = rows.map((row, index) => {
      const rowY = tableY + index * rowHeight;
      const isLastRow = index === rows.length - 1;
      const existingRowDraw = this.rowDraws[index];

      if (existingRowDraw) {
        existingRowDraw.update({
          row,
          index,
          x,
          y: rowY,
          width,
          height: rowHeight,
          isLastRow,
        });
        return existingRowDraw;
      }

      const rowDraw = new TableRowDraw({
        row,
        index,
        x,
        y: rowY,
        width,
        height: rowHeight,
        isLastRow,
      });
      this.bindRowHandlers(rowDraw);
      return rowDraw;
    });

    const children = [
      ...(this.titleDraw ? [this.titleDraw] : []),
      this.frameDraw,
      ...this.rowDraws,
    ];

    this.setChildren(children);
  }

  private bindRowHandlers(rowDraw: TableRowDraw) {
    this.rowClickHandlers.forEach((handler) => {
      rowDraw.onClick((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });

    this.rowMouseEnterHandlers.forEach((handler) => {
      rowDraw.onMouseEnter((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });

    this.rowMouseLeaveHandlers.forEach((handler) => {
      rowDraw.onMouseLeave((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });
  }
}

type TableRowHandler = (
  row: WorkflowTableRow,
  index: number,
  event: DrawMouseEvent,
) => void;

type TableRowDrawOptions = {
  row: WorkflowTableRow;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isLastRow: boolean;
};

export class TableRowDraw extends GroupDraw {
  private hovered = false;
  private options: TableRowDrawOptions;
  private backgroundDraw: ShapeDraw;
  private labelDraw: TextDraw;
  private valueDraw: TextDraw;
  private dividerDraw: LineDraw;

  constructor(options: TableRowDrawOptions) {
    const backgroundDraw = new ShapeDraw(
      {
        kind: "rect",
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height,
        radius: 0,
      },
      {},
    );
    const labelDraw = new TextDraw({
      text: options.row.label,
      x: options.x + 14,
      y: options.y + options.height / 2,
      font: "500 12px sans-serif",
      fillStyle: "rgba(71, 85, 105, 0.92)",
      textBaseline: "middle",
    });
    const valueDraw = new TextDraw({
      text: options.row.value,
      x: options.x + options.width - 14,
      y: options.y + options.height / 2,
      font: "500 12px ui-monospace, SFMono-Regular, Menlo, monospace",
      fillStyle: getRowToneColor(options.row.tone),
      textAlign: "right",
      textBaseline: "middle",
      maxWidth: options.width - 130,
    });
    const dividerDraw = new LineDraw(
      {
        kind: "polyline",
        points: [
          { x: options.x + 12, y: options.y + options.height },
          { x: options.x + options.width - 12, y: options.y + options.height },
        ],
      },
      {
        strokeStyle: "rgba(148, 163, 184, 0.18)",
        lineWidth: 1,
      },
    );

    super([backgroundDraw, labelDraw, valueDraw, dividerDraw]);
    this.options = options;
    this.backgroundDraw = backgroundDraw;
    this.labelDraw = labelDraw;
    this.valueDraw = valueDraw;
    this.dividerDraw = dividerDraw;

    this.onMouseEnter(() => {
      this.hovered = true;
      this.syncStyle();
    }).onMouseLeave(() => {
      this.hovered = false;
      this.syncStyle();
    });

    this.sync();
  }

  getRow() {
    return this.options.row;
  }

  getIndex() {
    return this.options.index;
  }

  update(options: TableRowDrawOptions) {
    this.options = options;
    this.sync();
  }

  override hitTest(point: Point) {
    return (
      point.x >= this.options.x &&
      point.x <= this.options.x + this.options.width &&
      point.y >= this.options.y &&
      point.y <= this.options.y + this.options.height
    );
  }

  override getBounds(): Rect {
    return {
      x: this.options.x,
      y: this.options.y,
      width: this.options.width,
      height: this.options.height,
    };
  }

  private sync() {
    const { row, index, x, y, width, height, isLastRow } = this.options;

    this.backgroundDraw.setGeometry({
      kind: "rect",
      x,
      y,
      width,
      height,
      radius: 0,
    });
    this.labelDraw.update({
      text: row.label,
      x: x + 14,
      y: y + height / 2,
    });
    this.valueDraw.update({
      text: row.value,
      x: x + width - 14,
      y: y + height / 2,
      fillStyle: getRowToneColor(row.tone),
      maxWidth: width - 130,
    });
    this.dividerDraw.visible = !isLastRow;
    this.dividerDraw.setGeometry({
      kind: "polyline",
      points: [
        { x: x + 12, y: y + height },
        { x: x + width - 12, y: y + height },
      ],
    });

    this.syncStyle(index, isLastRow);
  }

  private syncStyle(index = this.options.index, isLastRow = this.options.isLastRow) {
    const fillStyle = this.hovered
      ? "rgba(219, 234, 254, 0.92)"
      : index % 2 === 0
        ? "rgba(248, 250, 252, 0.85)"
        : "rgba(255, 255, 255, 0.96)";

    this.backgroundDraw.setStyle({
      fillStyle,
      globalAlpha: isLastRow ? 0.96 : 1,
    });
    this.labelDraw.update({
      fillStyle: this.hovered ? "#1d4ed8" : "rgba(71, 85, 105, 0.92)",
    });
  }
}

function getRowToneColor(tone: WorkflowTableRow["tone"]) {
  switch (tone) {
    case "accent":
      return "#2563eb";
    case "danger":
      return "#dc2626";
    case "muted":
      return "rgba(100, 116, 139, 0.9)";
    default:
      return "#0f172a";
  }
}
