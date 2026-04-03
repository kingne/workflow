import type { Point, Rect, Size, ViewTransform } from "../types.ts";
import type { Draw } from "../draw/Draw.ts";

export class RenderManager {
  private draws: Draw[] = [];
  private frameId: number | null = null;
  private animationResolver: (() => boolean) | null = null;
  private viewportSize: Size = { width: 0, height: 0 };
  private dpr = 1;
  private viewTransform: ViewTransform = {
    x: 0,
    y: 0,
    scale: 1,
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private context: CanvasRenderingContext2D,
  ) {}

  setDraws(draws: Draw[]) {
    this.draws = draws;
    this.requestRender();
  }

  setAnimationResolver(resolver: (() => boolean) | null) {
    this.animationResolver = resolver;

    if (resolver?.()) {
      this.requestRender();
    }
  }

  getViewportSize() {
    return { ...this.viewportSize };
  }

  getViewTransform() {
    return { ...this.viewTransform };
  }

  resize(width: number, height: number) {
    this.dpr = Math.max(window.devicePixelRatio || 1, 1);
    this.viewportSize = { width, height };
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.requestRender();
  }

  screenToWorld(point: Point): Point {
    return {
      x: (point.x - this.viewTransform.x) / this.viewTransform.scale,
      y: (point.y - this.viewTransform.y) / this.viewTransform.scale,
    };
  }

  worldToScreen(point: Point): Point {
    return {
      x: point.x * this.viewTransform.scale + this.viewTransform.x,
      y: point.y * this.viewTransform.scale + this.viewTransform.y,
    };
  }

  panBy(deltaX: number, deltaY: number) {
    this.viewTransform.x += deltaX;
    this.viewTransform.y += deltaY;
    this.requestRender();
  }

  zoomAt(screenPoint: Point, zoomFactor: number) {
    const currentScale = this.viewTransform.scale;
    const nextScale = clamp(currentScale * zoomFactor, 0.3, 2.5);

    if (Math.abs(nextScale - currentScale) < 0.0001) {
      return;
    }

    const worldPoint = this.screenToWorld(screenPoint);
    this.viewTransform.scale = nextScale;
    this.viewTransform.x = screenPoint.x - worldPoint.x * nextScale;
    this.viewTransform.y = screenPoint.y - worldPoint.y * nextScale;
    this.requestRender();
  }

  resetView() {
    this.viewTransform = {
      x: 0,
      y: 0,
      scale: 1,
    };
    this.requestRender();
  }

  fitView(rect: Rect, options?: { padding?: number; minScale?: number; maxScale?: number }) {
    const { width: viewportWidth, height: viewportHeight } = this.viewportSize;

    if (viewportWidth <= 0 || viewportHeight <= 0 || rect.width < 0 || rect.height < 0) {
      return;
    }

    const padding = options?.padding ?? 80;
    const minScale = options?.minScale ?? 0.2;
    const maxScale = options?.maxScale ?? 2.5;
    const safeWidth = Math.max(rect.width, 1);
    const safeHeight = Math.max(rect.height, 1);
    const availableWidth = Math.max(1, viewportWidth - padding * 2);
    const availableHeight = Math.max(1, viewportHeight - padding * 2);
    const scale = clamp(
      Math.min(availableWidth / safeWidth, availableHeight / safeHeight),
      minScale,
      maxScale,
    );
    const contentCenterX = rect.x + rect.width / 2;
    const contentCenterY = rect.y + rect.height / 2;

    this.viewTransform.scale = scale;
    this.viewTransform.x = viewportWidth / 2 - contentCenterX * scale;
    this.viewTransform.y = viewportHeight / 2 - contentCenterY * scale;
    this.requestRender();
  }

  focusRect(rect: Rect, options?: { scale?: number; maxScale?: number }) {
    const { width: viewportWidth, height: viewportHeight } = this.viewportSize;

    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    const targetScale = clamp(
      options?.scale ?? this.viewTransform.scale,
      0.2,
      options?.maxScale ?? 2.5,
    );
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    this.viewTransform.scale = targetScale;
    this.viewTransform.x = viewportWidth / 2 - centerX * targetScale;
    this.viewTransform.y = viewportHeight / 2 - centerY * targetScale;
    this.requestRender();
  }

  pick(screenPoint: Point): Draw | null {
    const worldPoint = this.screenToWorld(screenPoint);

    for (let index = this.draws.length - 1; index >= 0; index -= 1) {
      const draw = this.draws[index];

      if (!draw || !draw.visible) {
        continue;
      }

      const point = draw.renderSpace === "screen" ? screenPoint : worldPoint;
      const target = draw.findTarget(point);

      if (target) {
        return target;
      }
    }

    return null;
  }

  requestRender() {
    this.scheduleNextFrame();
  }

  destroy() {
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private render() {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let currentSpace: "world" | "screen" | null = null;

    this.draws.forEach((draw) => {
      if (draw.renderSpace !== currentSpace) {
        currentSpace = draw.renderSpace;

        if (currentSpace === "screen") {
          this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        } else {
          this.context.setTransform(
            this.dpr * this.viewTransform.scale,
            0,
            0,
            this.dpr * this.viewTransform.scale,
            this.dpr * this.viewTransform.x,
            this.dpr * this.viewTransform.y,
          );
        }
      }

      draw.draw(this.context);
    });

    if (this.animationResolver?.()) {
      this.scheduleNextFrame();
    }
  }

  private scheduleNextFrame() {
    if (this.frameId !== null) {
      return;
    }

    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null;
      this.render();
    });
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
