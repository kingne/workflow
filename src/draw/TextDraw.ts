import { Draw } from "./Draw.ts";
import type { Point } from "../types.ts";

type TextDrawOptions = {
  text: string;
  x: number;
  y: number;
  font?: string;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  maxWidth?: number;
  globalAlpha?: number;
};

export class TextDraw extends Draw {
  constructor(
    public options: TextDrawOptions,
    renderSpace: "world" | "screen" = "world",
  ) {
    super(renderSpace);
  }

  update(options: Partial<TextDrawOptions>) {
    this.options = { ...this.options, ...options };
  }

  override hitTest(point: Point) {
    const bounds = getTextBounds(this.options);

    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }

  protected onDraw(context: CanvasRenderingContext2D) {
    const {
      text,
      x,
      y,
      font = "500 14px sans-serif",
      fillStyle = "#0f172a",
      strokeStyle,
      lineWidth = 1,
      textAlign = "left",
      textBaseline = "alphabetic",
      maxWidth,
      globalAlpha = 1,
    } = this.options;

    context.globalAlpha = globalAlpha;
    context.font = font;
    context.textAlign = textAlign;
    context.textBaseline = textBaseline;

    if (strokeStyle) {
      context.strokeStyle = strokeStyle;
      context.lineWidth = lineWidth;
      context.strokeText(text, x, y, maxWidth);
    }

    context.fillStyle = fillStyle;
    context.fillText(text, x, y, maxWidth);
  }
}

const measureContext = document.createElement("canvas").getContext("2d");

function getTextBounds(options: TextDrawOptions) {
  const {
    text,
    x,
    y,
    font = "500 14px sans-serif",
    textAlign = "left",
    textBaseline = "alphabetic",
    maxWidth,
  } = options;

  if (!measureContext) {
    return { x, y, width: 0, height: 0 };
  }

  measureContext.font = font;
  const metrics = measureContext.measureText(text);
  const width = Math.min(metrics.width, maxWidth ?? Number.POSITIVE_INFINITY);
  const ascent = metrics.actualBoundingBoxAscent || extractFontSize(font) * 0.8;
  const descent = metrics.actualBoundingBoxDescent || extractFontSize(font) * 0.2;
  const height = ascent + descent;

  let left = x;
  if (textAlign === "center") {
    left = x - width / 2;
  } else if (textAlign === "right" || textAlign === "end") {
    left = x - width;
  }

  let top = y - ascent;
  if (textBaseline === "top" || textBaseline === "hanging") {
    top = y;
  } else if (textBaseline === "middle") {
    top = y - height / 2;
  } else if (textBaseline === "bottom" || textBaseline === "ideographic") {
    top = y - height;
  }

  return {
    x: left,
    y: top,
    width,
    height,
  };
}

function extractFontSize(font: string) {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 14;
}
