import { GridDraw } from "./draw/GridDraw.ts";
import { EventManager, type WorkflowEventPayload, type WorkflowEventType } from "./events/EventManager.ts";
import { History } from "./history/History.ts";
import { KeyControl } from "./input/KeyControl.ts";
import { Mouse } from "./input/Mouse.ts";
import { RenderManager } from "./render/RenderManager.ts";
import type { WorkflowEdgeModel, WorkflowNodeModel } from "./types.ts";
import { Scene } from "./workflow/Scene.ts";
import { Select } from "./workflow/Select.ts";

export type WorkflowAppOptions = {
  canvas: HTMLCanvasElement;
  nodes: WorkflowNodeModel[];
  edges?: WorkflowEdgeModel[];
  autoResize?: boolean;
  autoFitView?: boolean;
  fitViewPadding?: number;
};

export type WorkflowFocusOptions = {
  scale?: number;
  maxScale?: number;
};

export type WorkflowCreateNodeOptions = {
  focus?: boolean;
};

export class WorkflowApp {
  private readonly eventManager = new EventManager();
  private readonly nodes: WorkflowNodeModel[];
  private readonly edges: WorkflowEdgeModel[];
  private renderManager: RenderManager | null = null;
  private history: History | null = null;
  private scene: Scene | null = null;
  private select: Select | null = null;
  private keyControl: KeyControl | null = null;
  private mouse: Mouse | null = null;
  private gridDraw: GridDraw | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private started = false;

  constructor(private options: WorkflowAppOptions) {
    this.nodes = options.nodes.map(cloneNodeModel);
    this.edges = (options.edges ?? []).map(cloneEdgeModel);
  }

  start() {
    if (this.started) {
      return this;
    }

    const context = this.options.canvas.getContext("2d");

    if (!context) {
      throw new Error("2D rendering context is not supported.");
    }

    this.renderManager = new RenderManager(this.options.canvas, context);
    this.history = new History(() => {
      this.renderManager?.requestRender();
    });
    this.scene = new Scene(this.nodes, this.edges, this.history);
    this.select = new Select(this.scene, this.renderManager);
    this.keyControl = new KeyControl({
      deleteSelection: () => {
        if (this.scene?.deleteSelection()) {
          this.renderManager?.requestRender();
        }
      },
      undo: () => {
        if (this.history?.undo()) {
          this.renderManager?.requestRender();
        }
      },
      redo: () => {
        if (this.history?.redo()) {
          this.renderManager?.requestRender();
        }
      },
    });
    this.mouse = new Mouse(
      this.options.canvas,
      this.renderManager,
      this.scene,
      this.select,
      this.keyControl,
      this.eventManager,
    );
    this.gridDraw = new GridDraw(
      () => this.renderManager?.getViewportSize() ?? { width: 0, height: 0 },
      () => this.renderManager?.getViewTransform() ?? { x: 0, y: 0, scale: 1 },
    );

    this.renderManager.setAnimationResolver(() => this.scene?.hasActiveAnimations() ?? false);
    this.renderManager.setDraws([this.gridDraw, ...this.scene.getRenderLayers()]);
    this.keyControl.attach();
    this.mouse.attach();
    this.attachResize();
    this.resize();

    if (this.options.autoFitView !== false) {
      this.fitView({ padding: this.options.fitViewPadding ?? 120 });
    }

    this.started = true;
    return this;
  }

  destory() {
    if (!this.started) {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mouse?.destroy();
    this.keyControl?.destroy();
    this.renderManager?.destroy();
    this.renderManager = null;
    this.history = null;
    this.scene = null;
    this.select = null;
    this.keyControl = null;
    this.mouse = null;
    this.gridDraw = null;
    this.started = false;
  }

  resize() {
    if (!this.renderManager) {
      return false;
    }

    const rect = this.options.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.options.canvas.clientWidth || this.options.canvas.width || 1));
    const height = Math.max(
      1,
      Math.round(rect.height || this.options.canvas.clientHeight || this.options.canvas.height || 1),
    );

    this.renderManager.resize(width, height);
    return true;
  }

  fitView(options?: { padding?: number; minScale?: number; maxScale?: number }) {
    if (!this.renderManager || !this.scene) {
      return false;
    }

    const bounds = this.scene.getWorldBounds();

    if (!bounds) {
      return false;
    }

    this.renderManager.fitView(bounds, {
      padding: options?.padding ?? this.options.fitViewPadding ?? 120,
      minScale: options?.minScale,
      maxScale: options?.maxScale,
    });
    return true;
  }

  focusNode(nodeId: string, options?: WorkflowFocusOptions) {
    if (!this.renderManager || !this.scene) {
      return false;
    }

    const bounds = this.scene.focusNode(nodeId);

    if (!bounds) {
      return false;
    }

    this.renderManager.focusRect(bounds, {
      scale: options?.scale ?? Math.max(this.renderManager.getViewTransform().scale, 1),
      maxScale: options?.maxScale,
    });
    return true;
  }

  createNode(node: WorkflowNodeModel, options?: WorkflowCreateNodeOptions) {
    if (this.getNode(node.id)) {
      return null;
    }

    const nextNode = cloneNodeModel(node);
    this.nodes.push(nextNode);

    if (this.scene && this.renderManager) {
      const createdNode = this.scene.createNode(nextNode);

      if (!createdNode) {
        this.nodes.pop();
        return null;
      }

      if (options?.focus) {
        const bounds = createdNode.getBounds();
        this.renderManager.focusRect(bounds, {
          scale: Math.max(this.renderManager.getViewTransform().scale, 1),
        });
      } else {
        this.renderManager.requestRender();
      }
    }

    return nextNode;
  }

  updateNode(nodeId: string, patch: Partial<WorkflowNodeModel>) {
    const node = this.scene?.getNodeById(nodeId)?.model ?? this.nodes.find((item) => item.id === nodeId);

    if (!node) {
      return false;
    }

    Object.assign(node, {
      ...patch,
      inputs: patch.inputs ? patch.inputs.map(clonePortModel) : node.inputs,
      outputs: patch.outputs ? patch.outputs.map(clonePortModel) : node.outputs,
      parameters: patch.parameters ? patch.parameters.map((row) => ({ ...row })) : node.parameters,
    });

    if (this.scene && this.renderManager) {
      this.scene.syncFromModels();
      this.renderManager.requestRender();
    }

    return true;
  }

  getNode(nodeId: string) {
    return this.scene?.getNodeById(nodeId)?.model ?? this.nodes.find((item) => item.id === nodeId) ?? null;
  }

  on(type: WorkflowEventType, handler: (payload: WorkflowEventPayload) => void) {
    return this.eventManager.on(type, handler);
  }

  getEventManager() {
    return this.eventManager;
  }

  private attachResize() {
    if (this.options.autoResize === false || typeof ResizeObserver === "undefined") {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.options.canvas);
  }
}

function cloneNodeModel(node: WorkflowNodeModel): WorkflowNodeModel {
  return {
    ...node,
    inputs: node.inputs.map(clonePortModel),
    outputs: node.outputs.map(clonePortModel),
    parameters: node.parameters.map((row) => ({ ...row })),
  };
}

function clonePortModel(port: WorkflowNodeModel["inputs"][number]) {
  return { ...port };
}

function cloneEdgeModel(edge: WorkflowEdgeModel): WorkflowEdgeModel {
  return { ...edge };
}
