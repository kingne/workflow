import { Draw } from "./Draw.ts";
import { createRoundedRectPath } from "../utils/canvas.ts";
import type { Point } from "../types.ts";

type ImageDrawOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  opacity?: number;
};

export class ImageDraw extends Draw {
  private image: HTMLImageElement | null = null;

  constructor(
    public options: ImageDrawOptions,
    private onLoad?: () => void,
    renderSpace: "world" | "screen" = "world",
  ) {
    super(renderSpace);
  }

  setSource(source: string) {
    const image = new Image();
    image.onload = () => {
      this.image = image;
      this.onLoad?.();
    };
    image.src = source;
  }

  update(options: Partial<ImageDrawOptions>) {
    this.options = { ...this.options, ...options };
  }

  override hitTest(point: Point) {
    const { x, y, width, height } = this.options;
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
  }

  protected onDraw(context: CanvasRenderingContext2D) {
    if (!this.image || !this.image.complete) {
      return;
    }

    const { x, y, width, height, radius = 0, opacity = 1 } = this.options;

    context.globalAlpha = opacity;

    if (radius > 0) {
      context.beginPath();
      createRoundedRectPath(context, x, y, width, height, radius);
      context.clip();
    }

    context.drawImage(this.image, x, y, width, height);
  }
}
