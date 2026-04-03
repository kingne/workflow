import type { Draw } from "../draw/Draw.ts";
import { EdgeDraw } from "../draw/EdgeDraw.ts";
import { GroupDraw } from "../draw/GroupDraw.ts";
import { NodeDraw, type NodeEventItemDetail } from "../draw/NodeDraw.ts";
import { PortDraw } from "../draw/PortDraw.ts";
import type {
  Rect,
  WorkflowEdgeModel,
  WorkflowNodeModel,
  WorkflowPortDirection,
  WorkflowPortModel,
} from "../types.ts";
import { validateEdgeConnection } from "./connection.ts";
import type { History } from "../history/History.ts";

type SceneSelectable = NodeDraw | EdgeDraw;
export type SceneEventTargetDetail =
  | {
      kind: "canvas";
      item: "canvas";
      nodeId: null;
      edgeId: null;
    }
  | ({
      kind: "node";
      nodeId: string;
      edgeId: null;
    } & NodeEventItemDetail)
  | {
      kind: "edge";
      item: "edge";
      nodeId: null;
      edgeId: string;
    };
export type EdgeDraft = Omit<WorkflowEdgeModel, "id">;
export type ScenePortTarget = {
  nodeDraw: NodeDraw;
  portDraw: PortDraw;
  direction: WorkflowPortDirection;
  port: WorkflowPortModel;
};

type DeletedNodeSnapshot = {
  draw: NodeDraw;
  index: number;
};

type DeletedEdgeSnapshot = {
  draw: EdgeDraw;
  index: number;
};

export class Scene {
  private readonly worldLayer = new GroupDraw();
  private readonly worldOverlayLayer = new GroupDraw();
  private readonly screenLayer = new GroupDraw([], "screen");
  private nodeDraws: NodeDraw[];
  private edgeDraws: EdgeDraw[];
  private nodeDrawMap: Map<string, NodeDraw>;
  private selectedItems = new Set<SceneSelectable>();

  constructor(
    nodeModels: WorkflowNodeModel[],
    edgeModels: WorkflowEdgeModel[],
    private history: History,
  ) {
    this.nodeDraws = nodeModels.map((node) => new NodeDraw(node));
    this.nodeDrawMap = new Map(this.nodeDraws.map((nodeDraw) => [nodeDraw.model.id, nodeDraw]));
    this.edgeDraws = edgeModels
      .filter((edge) => {
        const validation = validateEdgeConnection(edge, (id) => this.getNodeById(id)?.model ?? null);

        if (!validation.ok) {
          console.warn(`Invalid edge ${edge.id}: ${validation.reason}`);
          return false;
        }

        return true;
      })
      .map((edge) => new EdgeDraw(edge, (id) => this.getNodeById(id)));

    this.refreshEdges();
    this.syncWorldLayer();
  }

  getRenderLayers() {
    return [this.worldLayer, this.worldOverlayLayer, this.screenLayer];
  }

  setWorldOverlayDraws(draws: Draw[]) {
    this.worldOverlayLayer.setChildren(draws);
  }

  setScreenDraws(draws: Draw[]) {
    this.screenLayer.setChildren(draws);
  }

  getNodeDraws() {
    return [...this.nodeDraws];
  }

  getEdgeDraws() {
    return [...this.edgeDraws];
  }

  getNodeById(id: string) {
    return this.nodeDrawMap.get(id) ?? null;
  }

  getWorldBounds() {
    if (this.nodeDraws.length === 0) {
      return null;
    }

    const bounds = this.nodeDraws.map((nodeDraw) => nodeDraw.getBounds());
    const minX = Math.min(...bounds.map((bound) => bound.x));
    const minY = Math.min(...bounds.map((bound) => bound.y));
    const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
    const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  getNodeBounds(nodeId: string) {
    return this.getNodeById(nodeId)?.getBounds() ?? null;
  }

  updateNodeStatus(
    nodeId: string,
    status: WorkflowNodeModel["statusTone"],
    options?: {
      statusLabel?: string;
      errorText?: string;
    },
  ) {
    const nodeDraw = this.getNodeById(nodeId);

    if (!nodeDraw) {
      return false;
    }

    nodeDraw.model.statusTone = status;
    nodeDraw.model.statusLabel = options?.statusLabel ?? getDefaultStatusLabel(status);
    nodeDraw.model.errorText =
      options?.errorText ??
      (status === "error" ? "Runtime error" : status === "running" ? "Streaming output..." : "Ready");

    this.syncFromModels();
    return true;
  }

  getPortTargets() {
    return this.nodeDraws.flatMap((nodeDraw) =>
      nodeDraw.getPortDraws().map((portDraw) => ({
        nodeDraw,
        portDraw,
        direction: portDraw.getDirection(),
        port: portDraw.getPort(),
      })),
    );
  }

  resolveEventTarget(draw: Draw | null): SceneEventTargetDetail {
    if (!draw) {
      return {
        kind: "canvas",
        item: "canvas",
        nodeId: null,
        edgeId: null,
      };
    }

    const selectable = this.resolveSelectable(draw);

    if (selectable instanceof NodeDraw) {
      return {
        kind: "node",
        nodeId: selectable.model.id,
        edgeId: null,
        ...selectable.resolveEventItem(draw),
      };
    }

    if (selectable instanceof EdgeDraw) {
      return {
        kind: "edge",
        item: "edge",
        nodeId: null,
        edgeId: selectable.model.id,
      };
    }

    return {
      kind: "canvas",
      item: "canvas",
      nodeId: null,
      edgeId: null,
    };
  }

  getSelectionEventTargets() {
    return this.getSelection().map((item) => this.describeSelectable(item));
  }

  resolvePortTarget(draw: Draw | null): ScenePortTarget | null {
    let current = draw;
    let portDraw: PortDraw | null = null;
    let nodeDraw: NodeDraw | null = null;

    while (current) {
      if (!portDraw && current instanceof PortDraw) {
        portDraw = current;
      }

      if (current instanceof NodeDraw) {
        nodeDraw = current;
        break;
      }

      current = current.parent;
    }

    if (!portDraw || !nodeDraw) {
      return null;
    }

    return {
      nodeDraw,
      portDraw,
      direction: portDraw.getDirection(),
      port: portDraw.getPort(),
    };
  }

  resolveSelectable(draw: Draw | null): SceneSelectable | null {
    let current = draw;

    while (current) {
      if (current instanceof NodeDraw || current instanceof EdgeDraw) {
        return current;
      }

      current = current.parent;
    }

    return null;
  }

  getDraggableNode(draw: Draw | null) {
    const selectable = this.resolveSelectable(draw);

    if (!(selectable instanceof NodeDraw)) {
      return null;
    }

    return selectable.isDraggableTarget(draw) ? selectable : null;
  }

  focusNode(nodeId: string) {
    const nodeDraw = this.getNodeById(nodeId);

    if (!nodeDraw) {
      return null;
    }

    this.moveNodeToFront(nodeDraw);
    this.selectOnly(nodeDraw);
    return nodeDraw.getBounds();
  }

  moveNodeToFront(targetNode: NodeDraw) {
    const index = this.nodeDraws.findIndex((nodeDraw) => nodeDraw.model.id === targetNode.model.id);

    if (index < 0) {
      return;
    }

    const [nodeDraw] = this.nodeDraws.splice(index, 1);

    if (nodeDraw) {
      this.nodeDraws.push(nodeDraw);
      this.syncWorldLayer();
    }
  }

  refreshEdges() {
    this.edgeDraws.forEach((edgeDraw) => edgeDraw.refresh());
  }

  hasActiveAnimations() {
    return (
      this.nodeDraws.some((nodeDraw) => nodeDraw.isRunning()) ||
      this.edgeDraws.some((edgeDraw) => edgeDraw.isAnimating())
    );
  }

  syncFromModels() {
    this.nodeDraws.forEach((nodeDraw) => nodeDraw.syncFromModel());
    this.edgeDraws = this.edgeDraws.filter((edgeDraw) => {
      const validation = validateEdgeConnection(
        edgeDraw.model,
        (id) => this.getNodeById(id)?.model ?? null,
      );

      if (!validation.ok) {
        this.selectedItems.delete(edgeDraw);
      }

      return validation.ok;
    });

    this.applySelectionStyles();
    this.refreshEdges();
    this.syncWorldLayer();
  }

  setSelection(items: SceneSelectable[]) {
    this.selectedItems = new Set(items);
    this.applySelectionStyles();
  }

  selectOnly(item: SceneSelectable | null) {
    this.setSelection(item ? [item] : []);
  }

  clearSelection() {
    this.setSelection([]);
  }

  getSelection() {
    return [...this.selectedItems];
  }

  selectInRect(rect: Rect) {
    const selectedItems = [
      ...this.nodeDraws.filter((nodeDraw) => nodeDraw.intersectsRect(rect)),
      ...this.edgeDraws.filter((edgeDraw) => edgeDraw.intersectsRect(rect)),
    ];

    this.setSelection(selectedItems);
    return selectedItems;
  }

  validateEdgeCandidate(edge: EdgeDraft) {
    const duplicatedEdge = this.edgeDraws.find(
      (edgeDraw) =>
        edgeDraw.model.fromNodeId === edge.fromNodeId &&
        edgeDraw.model.fromPortId === edge.fromPortId &&
        edgeDraw.model.toNodeId === edge.toNodeId &&
        edgeDraw.model.toPortId === edge.toPortId,
    );

    if (duplicatedEdge) {
      return {
        ok: false as const,
        reason: "Connection already exists",
      };
    }

    return validateEdgeConnection(
      {
        id: "__preview__",
        ...edge,
      },
      (id) => this.getNodeById(id)?.model ?? null,
    );
  }

  createEdge(edgeDraft: EdgeDraft) {
    const validation = this.validateEdgeCandidate(edgeDraft);

    if (!validation.ok) {
      return null;
    }

    const previousSelection = this.getSelection();
    const edgeDraw = new EdgeDraw(
      {
        id: createEdgeId(),
        ...edgeDraft,
      },
      (id) => this.getNodeById(id),
    );

    const applyCreate = () => {
      if (!this.edgeDraws.includes(edgeDraw)) {
        this.edgeDraws.push(edgeDraw);
      }

      this.selectOnly(edgeDraw);
      this.refreshEdges();
      this.syncWorldLayer();
    };

    const revertCreate = () => {
      const index = this.edgeDraws.indexOf(edgeDraw);

      if (index >= 0) {
        this.edgeDraws.splice(index, 1);
      }

      this.setSelection(previousSelection.filter((item) => item !== edgeDraw));
      this.refreshEdges();
      this.syncWorldLayer();
    };

    applyCreate();
    this.history.push({
      label: "Create edge",
      undo: revertCreate,
      redo: applyCreate,
    });

    return edgeDraw;
  }

  createNode(nodeModel: WorkflowNodeModel) {
    if (this.nodeDrawMap.has(nodeModel.id)) {
      return null;
    }

    const previousSelection = this.getSelection();
    const nodeDraw = new NodeDraw(nodeModel);

    const applyCreate = () => {
      if (!this.nodeDrawMap.has(nodeDraw.model.id)) {
        this.nodeDraws.push(nodeDraw);
        this.nodeDrawMap.set(nodeDraw.model.id, nodeDraw);
      }

      this.selectOnly(nodeDraw);
      this.refreshEdges();
      this.syncWorldLayer();
    };

    const revertCreate = () => {
      const index = this.nodeDraws.indexOf(nodeDraw);

      if (index >= 0) {
        this.nodeDraws.splice(index, 1);
      }

      this.nodeDrawMap.delete(nodeDraw.model.id);
      this.setSelection(previousSelection.filter((item) => item !== nodeDraw));
      this.refreshEdges();
      this.syncWorldLayer();
    };

    applyCreate();
    this.history.push({
      label: "Create node",
      undo: revertCreate,
      redo: applyCreate,
    });

    return nodeDraw;
  }

  deleteSelection() {
    const selectedItems = this.getSelection();

    if (selectedItems.length === 0) {
      return false;
    }

    const selectedNodes = selectedItems.filter((item): item is NodeDraw => item instanceof NodeDraw);
    const selectedEdges = new Set(
      selectedItems.filter((item): item is EdgeDraw => item instanceof EdgeDraw),
    );

    selectedNodes.forEach((nodeDraw) => {
      this.edgeDraws.forEach((edgeDraw) => {
        if (
          edgeDraw.model.fromNodeId === nodeDraw.model.id ||
          edgeDraw.model.toNodeId === nodeDraw.model.id
        ) {
          selectedEdges.add(edgeDraw);
        }
      });
    });

    const deletedNodeSnapshots = selectedNodes
      .map((draw) => ({
        draw,
        index: this.nodeDraws.indexOf(draw),
      }))
      .filter((snapshot) => snapshot.index >= 0)
      .sort((left, right) => left.index - right.index);

    const deletedEdgeSnapshots = [...selectedEdges]
      .map((draw) => ({
        draw,
        index: this.edgeDraws.indexOf(draw),
      }))
      .filter((snapshot) => snapshot.index >= 0)
      .sort((left, right) => left.index - right.index);

    const applyDelete = () => {
      deletedEdgeSnapshots
        .slice()
        .sort((left, right) => right.index - left.index)
        .forEach(({ draw, index }) => {
          this.edgeDraws.splice(index, 1);
          this.selectedItems.delete(draw);
        });

      deletedNodeSnapshots
        .slice()
        .sort((left, right) => right.index - left.index)
        .forEach(({ draw, index }) => {
          this.nodeDraws.splice(index, 1);
          this.nodeDrawMap.delete(draw.model.id);
          this.selectedItems.delete(draw);
        });

      this.applySelectionStyles();
      this.refreshEdges();
      this.syncWorldLayer();
    };

    const restoreDelete = () => {
      deletedNodeSnapshots.forEach(({ draw, index }) => {
        this.nodeDraws.splice(index, 0, draw);
        this.nodeDrawMap.set(draw.model.id, draw);
      });

      deletedEdgeSnapshots.forEach(({ draw, index }) => {
        this.edgeDraws.splice(index, 0, draw);
      });

      this.setSelection([
        ...deletedNodeSnapshots.map((snapshot) => snapshot.draw),
        ...deletedEdgeSnapshots.map((snapshot) => snapshot.draw),
      ]);
      this.refreshEdges();
      this.syncWorldLayer();
    };

    applyDelete();
    this.history.push({
      label: "Delete selection",
      undo: restoreDelete,
      redo: applyDelete,
    });

    return true;
  }

  commitNodeMove(nodeDraw: NodeDraw, from: { x: number; y: number }, to: { x: number; y: number }) {
    if (from.x === to.x && from.y === to.y) {
      return false;
    }

    const applyMove = (point: { x: number; y: number }) => {
      nodeDraw.moveTo(point.x, point.y);
      this.refreshEdges();
      this.syncWorldLayer();
    };

    this.history.push({
      label: "Move node",
      undo: () => applyMove(from),
      redo: () => applyMove(to),
    });

    return true;
  }

  private applySelectionStyles() {
    this.nodeDraws.forEach((nodeDraw) => {
      nodeDraw.setSelected(this.selectedItems.has(nodeDraw));
    });

    this.edgeDraws.forEach((edgeDraw) => {
      edgeDraw.setSelected(this.selectedItems.has(edgeDraw));
    });
  }

  private describeSelectable(item: SceneSelectable): SceneEventTargetDetail {
    if (item instanceof NodeDraw) {
      return {
        kind: "node",
        nodeId: item.model.id,
        edgeId: null,
        item: "node",
      };
    }

    return {
      kind: "edge",
      item: "edge",
      nodeId: null,
      edgeId: item.model.id,
    };
  }

  private syncWorldLayer() {
    this.worldLayer.setChildren([...this.edgeDraws, ...this.nodeDraws]);
  }
}

function getDefaultStatusLabel(status: WorkflowNodeModel["statusTone"]) {
  switch (status) {
    case "running":
      return "Running";
    case "success":
      return "Success";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function createEdgeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `edge-${crypto.randomUUID()}`;
  }

  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
