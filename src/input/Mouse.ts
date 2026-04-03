import { Draw, type DrawMouseEvent } from "../draw/Draw.ts";
import type { Point } from "../types.ts";
import { ConnectionPreviewDraw } from "../draw/ConnectionPreviewDraw.ts";
import type {
  WorkflowConnectionMeta,
  WorkflowDragMeta,
  WorkflowEventType,
  WorkflowModifierState,
} from "../events/EventManager.ts";
import { EventManager } from "../events/EventManager.ts";
import { getPortTypeColor } from "../workflow/connection.ts";
import type { RenderManager } from "../render/RenderManager.ts";
import type { EdgeDraft, Scene, ScenePortTarget } from "../workflow/Scene.ts";
import type { Select } from "../workflow/Select.ts";
import type { KeyControl } from "./KeyControl.ts";

type MouseMode =
  | "idle"
  | "pending-node-drag"
  | "drag-node"
  | "pan-canvas"
  | "connect-edge"
  | "select-rect";

type ConnectionCandidateState = "none" | "valid" | "invalid";
const CONNECTION_SNAP_DISTANCE = 28;

export class Mouse {
  private mode: MouseMode = "idle";
  private activePointerId: number | null = null;
  private pointerScreen: Point = { x: 0, y: 0 };
  private lastPointerScreen: Point = { x: 0, y: 0 };
  private hoverPath: Draw[] = [];
  private pressedTarget: Draw | null = null;
  private pressStartScreen: Point = { x: 0, y: 0 };
  private pendingNodeId: string | null = null;
  private nodeDragOffset: Point = { x: 0, y: 0 };
  private nodeDragStart: Point | null = null;
  private connectionPreviewDraw = new ConnectionPreviewDraw();
  private connectionStartPort: ScenePortTarget | null = null;
  private connectionCandidatePort: ScenePortTarget | null = null;
  private connectionCandidateState: ConnectionCandidateState = "none";
  private connectionCandidateReason: string | null = null;
  private lastHoverEventTargetKey = "";

  constructor(
    private canvas: HTMLCanvasElement,
    private renderManager: RenderManager,
    private scene: Scene,
    private select: Select,
    private keyControl: KeyControl,
    private eventManager: EventManager,
  ) {
    this.scene.setWorldOverlayDraws([this.connectionPreviewDraw]);
  }

  attach() {
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.updateHoverState();
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("wheel", this.handleWheel);
  }

  private handlePointerDown = (event: PointerEvent) => {
    const isPrimaryButton = event.button === 0;
    const isMiddleButton = event.button === 1;

    if (!isPrimaryButton && !isMiddleButton) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.updatePointerScreen(event);
    this.lastPointerScreen = { ...this.pointerScreen };
    this.pressStartScreen = { ...this.pointerScreen };
    this.pressedTarget = this.renderManager.pick(this.pointerScreen);
    this.pendingNodeId = null;
    this.nodeDragStart = null;

    if (isMiddleButton || (isPrimaryButton && this.keyControl.isPanningModifierActive())) {
      this.mode = "pan-canvas";
      this.canvas.style.cursor = "grabbing";
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }

    const portTarget = this.scene.resolvePortTarget(this.pressedTarget);
    if (portTarget) {
      this.mode = "connect-edge";
      this.connectionStartPort = portTarget;
      this.connectionCandidatePort = null;
      this.connectionCandidateState = "none";
      this.connectionCandidateReason = null;
      this.select.selectByDraw(this.pressedTarget);
      this.emitSelectEvent(this.pressedTarget, event);
      this.syncConnectionInteraction();
      this.emitConnectionEvent("connectstart", event);
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }

    const draggableNode = this.scene.getDraggableNode(this.pressedTarget);
    if (draggableNode) {
      const worldPoint = this.renderManager.screenToWorld(this.pointerScreen);
      this.select.selectByDraw(this.pressedTarget);
      this.mode = "pending-node-drag";
      this.pendingNodeId = draggableNode.model.id;
      this.nodeDragStart = { x: draggableNode.model.x, y: draggableNode.model.y };
      this.nodeDragOffset = {
        x: worldPoint.x - draggableNode.model.x,
        y: worldPoint.y - draggableNode.model.y,
      };
      this.emitSelectEvent(this.pressedTarget, event);
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (this.pressedTarget) {
      this.mode = "idle";
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }

    this.mode = "select-rect";
    this.select.begin(this.pointerScreen);
    this.canvas.setPointerCapture(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent) => {
    this.updatePointerScreen(event);

    if (this.activePointerId === null || event.pointerId !== this.activePointerId) {
      this.updateHoverState(event);
      return;
    }

    if (this.mode === "pending-node-drag") {
      const moveDistance = Math.hypot(
        this.pointerScreen.x - this.pressStartScreen.x,
        this.pointerScreen.y - this.pressStartScreen.y,
      );

      if (moveDistance > 2 && this.pendingNodeId) {
        const nodeDraw = this.scene.getNodeById(this.pendingNodeId);

        if (nodeDraw) {
          this.mode = "drag-node";
          this.scene.moveNodeToFront(nodeDraw);
          nodeDraw.setDragging(true);
          this.scene.refreshEdges();
          this.emitDelegatedEvent("dragstart", this.pressedTarget, event);
        }
      }
    }

    if (this.mode === "drag-node" && this.pendingNodeId) {
      const nodeDraw = this.scene.getNodeById(this.pendingNodeId);

      if (nodeDraw) {
        const worldPoint = this.renderManager.screenToWorld(this.pointerScreen);
        nodeDraw.moveTo(
          worldPoint.x - this.nodeDragOffset.x,
          worldPoint.y - this.nodeDragOffset.y,
        );
        this.scene.refreshEdges();
        this.emitDelegatedEvent("dragmove", this.pressedTarget, event);
      }
    } else if (this.mode === "connect-edge") {
      this.syncConnectionInteraction();
      this.emitConnectionEvent("connectmove", event);
    } else if (this.mode === "pan-canvas") {
      const deltaX = this.pointerScreen.x - this.lastPointerScreen.x;
      const deltaY = this.pointerScreen.y - this.lastPointerScreen.y;
      this.renderManager.panBy(deltaX, deltaY);
    } else if (this.mode === "select-rect") {
      this.select.update(this.pointerScreen);
    }

    this.lastPointerScreen = { ...this.pointerScreen };
    this.updateHoverState(event);
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (this.activePointerId === null || event.pointerId !== this.activePointerId) {
      return;
    }

    this.updatePointerScreen(event);
    const isCancelled = event.type === "pointercancel";
    const releasedTarget = this.renderManager.pick(this.pointerScreen);

    if (isCancelled) {
      if (this.mode === "drag-node" && this.pendingNodeId) {
        const nodeDraw = this.scene.getNodeById(this.pendingNodeId);

        if (nodeDraw) {
          nodeDraw.setDragging(false);
          this.scene.refreshEdges();
        }
      }

      if (this.mode === "connect-edge") {
        this.emitConnectionEvent("connectend", event);
        this.clearConnectionPreview();
        this.clearConnectionFeedback();
      }

      if (this.mode === "select-rect") {
        this.select.end();
      }
    } else if (this.mode === "drag-node" && this.pendingNodeId && this.nodeDragStart) {
      const nodeDraw = this.scene.getNodeById(this.pendingNodeId);

      if (nodeDraw) {
        nodeDraw.setDragging(false);
        this.scene.refreshEdges();
        this.scene.commitNodeMove(
          nodeDraw,
          this.nodeDragStart,
          { x: nodeDraw.model.x, y: nodeDraw.model.y },
        );
        this.emitDelegatedEvent("dragend", this.pressedTarget, event);
      }
    } else if (this.mode === "connect-edge") {
      const edgeDraft = this.resolveEdgeDraft(this.connectionStartPort, this.connectionCandidatePort);
      let createdEdgeId: string | null = null;

      if (edgeDraft && this.connectionCandidateState === "valid") {
        const createdEdge = this.scene.createEdge(edgeDraft);

        if (!createdEdge) {
          const validation = this.scene.validateEdgeCandidate(edgeDraft);
          console.warn(
            `Connection rejected: ${validation.reason ?? "Invalid connection"}`,
          );
        } else {
          createdEdgeId = createdEdge.model.id;
        }
      } else if (this.connectionCandidateState === "invalid") {
        console.warn(`Connection rejected: ${this.connectionCandidateReason ?? "Invalid connection"}`);
      }

      this.emitConnectionEvent("connectend", event, createdEdgeId);
      this.clearConnectionFeedback();
      this.clearConnectionPreview();
    } else if (this.mode === "pending-node-drag") {
      this.select.selectByDraw(releasedTarget);
      this.emitSelectEvent(releasedTarget, event);
      this.dispatchClickIfNeeded(releasedTarget, event);
    } else if (this.mode === "idle") {
      if (releasedTarget) {
        this.select.selectByDraw(releasedTarget);
        this.emitSelectEvent(releasedTarget, event);
        this.dispatchClickIfNeeded(releasedTarget, event);
      } else {
        this.select.clearSelection();
        this.emitSelectEvent(null, event);
      }
    } else if (this.mode === "select-rect") {
      const didSelectByRect = this.select.end();

      if (!didSelectByRect) {
        this.select.clearSelection();
      }

      this.emitSelectEvent(null, event);
    }

    this.resetPointerState(event);
    this.updateHoverState(event);
  };

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const point = this.getRelativeScreenPoint(event.clientX, event.clientY);
    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    this.renderManager.zoomAt(point, zoomFactor);
  };

  private resetPointerState(event: PointerEvent) {
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    this.mode = "idle";
    this.activePointerId = null;
    this.pressedTarget = null;
    this.pendingNodeId = null;
    this.nodeDragStart = null;
    this.connectionStartPort = null;
    this.connectionCandidatePort = null;
    this.connectionCandidateState = "none";
    this.connectionCandidateReason = null;
  }

  private updatePointerScreen(event: PointerEvent) {
    this.pointerScreen = this.getRelativeScreenPoint(event.clientX, event.clientY);
  }

  private getRelativeScreenPoint(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  private updateHoverState(event?: PointerEvent) {
    const target = this.renderManager.pick(this.pointerScreen);
    const previousEventTarget = this.scene.resolveEventTarget(this.hoverPath[0] ?? null);
    const nextEventTarget = this.scene.resolveEventTarget(target);
    const nextPath = target ? this.getPathToRoot(target) : [];
    const previousPath = this.hoverPath;
    const sharedLength = this.getSharedRootLength(previousPath, nextPath);
    const baseEventTarget = target ?? previousPath[0] ?? null;
    const baseEvent = this.createBaseEvent(baseEventTarget, event);

    for (let index = 0; index < previousPath.length - sharedLength; index += 1) {
      const draw = previousPath[index];

      if (draw && baseEvent) {
        draw.emit("mouseleave", {
          ...baseEvent,
          currentTarget: draw,
          point: this.getPointForDraw(draw, baseEvent),
        });
      }
    }

    for (let index = nextPath.length - sharedLength - 1; index >= 0; index -= 1) {
      const draw = nextPath[index];

      if (draw && baseEvent) {
        draw.emit("mouseenter", {
          ...baseEvent,
          currentTarget: draw,
          point: this.getPointForDraw(draw, baseEvent),
        });
      }
    }

    nextPath.forEach((draw) => {
      if (draw && baseEvent) {
        draw.emit("mousemove", {
          ...baseEvent,
          currentTarget: draw,
          point: this.getPointForDraw(draw, baseEvent),
        });
      }
    });

    this.hoverPath = nextPath;
    this.emitHoverIfChanged(previousEventTarget, nextEventTarget, event);
    this.updateCursor(nextPath);
    this.renderManager.requestRender();
  }

  private dispatchClickIfNeeded(releasedTarget: Draw | null, event: PointerEvent) {
    if (!this.pressedTarget || !releasedTarget) {
      return;
    }

    const pressedPath = this.getPathToRoot(this.pressedTarget);
    const releasedPath = this.getPathToRoot(releasedTarget);
    const sharedLength = this.getSharedRootLength(pressedPath, releasedPath);

    if (sharedLength === 0) {
      return;
    }

    const commonTarget = pressedPath[pressedPath.length - sharedLength] ?? null;
    const path = commonTarget ? this.getPathToRoot(commonTarget) : [];
    const baseEvent = this.createBaseEvent(commonTarget, event);

    if (!baseEvent) {
      return;
    }

    path.forEach((draw) => {
      draw.emit("click", {
        ...baseEvent,
        currentTarget: draw,
        point: this.getPointForDraw(draw, baseEvent),
      });
    });

    this.emitDelegatedEvent("click", commonTarget, event);
  }

  private createBaseEvent(
    target: Draw | null,
    originalEvent?: PointerEvent,
  ): Omit<DrawMouseEvent, "currentTarget" | "point"> | null {
    if (!target || !originalEvent) {
      return null;
    }

    const screenPoint = { ...this.pointerScreen };
    const worldPoint = this.renderManager.screenToWorld(screenPoint);

    return {
      target,
      screenPoint,
      worldPoint,
      originalEvent,
    };
  }

  private getPointForDraw(
    draw: Draw,
    event: Omit<DrawMouseEvent, "currentTarget" | "point">,
  ) {
    return draw.renderSpace === "screen" ? event.screenPoint : event.worldPoint;
  }

  private getPathToRoot(draw: Draw) {
    const path: Draw[] = [];
    let current: Draw | null = draw;

    while (current) {
      path.push(current);
      current = current.parent;
    }

    return path;
  }

  private getSharedRootLength(firstPath: Draw[], secondPath: Draw[]) {
    let sharedLength = 0;

    while (
      sharedLength < firstPath.length &&
      sharedLength < secondPath.length &&
      firstPath[firstPath.length - 1 - sharedLength] ===
        secondPath[secondPath.length - 1 - sharedLength]
    ) {
      sharedLength += 1;
    }

    return sharedLength;
  }

  private updateCursor(path: Draw[]) {
    if (this.mode === "drag-node" || this.mode === "pan-canvas") {
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (this.mode === "connect-edge") {
      this.canvas.style.cursor = "crosshair";
      return;
    }

    if (this.keyControl.isPanningModifierActive()) {
      this.canvas.style.cursor = "grab";
      return;
    }

    const draggableNode = this.scene.getDraggableNode(path[0] ?? null);
    if (draggableNode) {
      this.canvas.style.cursor = "grab";
      return;
    }

    const hasInteractiveTarget = path.some((draw) => draw.hasMouseHandlers());
    this.canvas.style.cursor = hasInteractiveTarget ? "pointer" : "default";
  }

  private emitHoverIfChanged(
    previousTarget: import("../workflow/Scene.ts").SceneEventTargetDetail,
    nextTarget: import("../workflow/Scene.ts").SceneEventTargetDetail,
    originalEvent?: PointerEvent,
  ) {
    if (!originalEvent) {
      return;
    }

    const nextKey = this.getEventTargetKey(nextTarget);

    if (nextKey === this.lastHoverEventTargetKey) {
      return;
    }

    const hadPreviousTarget = this.lastHoverEventTargetKey !== "";
    this.lastHoverEventTargetKey = nextKey;
    this.eventManager.emit("hover", {
      target: nextTarget,
      previousTarget: hadPreviousTarget ? previousTarget : null,
      selection: this.scene.getSelectionEventTargets(),
      screenPoint: { ...this.pointerScreen },
      worldPoint: this.renderManager.screenToWorld(this.pointerScreen),
      button: originalEvent.button,
      buttons: originalEvent.buttons,
      modifiers: this.getModifierState(originalEvent),
      originalEvent,
    });
  }

  private emitSelectEvent(target: Draw | null, originalEvent?: PointerEvent) {
    if (!originalEvent) {
      return;
    }

    this.eventManager.emit("select", {
      target: this.scene.resolveEventTarget(target),
      selection: this.scene.getSelectionEventTargets(),
      screenPoint: { ...this.pointerScreen },
      worldPoint: this.renderManager.screenToWorld(this.pointerScreen),
      button: originalEvent.button,
      buttons: originalEvent.buttons,
      modifiers: this.getModifierState(originalEvent),
      originalEvent,
    });
  }

  private emitDelegatedEvent(
    type: "click" | "dragstart" | "dragmove" | "dragend",
    target: Draw | null,
    originalEvent?: PointerEvent,
  ) {
    if (!originalEvent) {
      return;
    }

    this.eventManager.emit(type, {
      target: this.scene.resolveEventTarget(target),
      selection: this.scene.getSelectionEventTargets(),
      screenPoint: { ...this.pointerScreen },
      worldPoint: this.renderManager.screenToWorld(this.pointerScreen),
      button: originalEvent.button,
      buttons: originalEvent.buttons,
      modifiers: this.getModifierState(originalEvent),
      drag: this.isDragEventType(type) ? this.getDragMeta() : undefined,
      originalEvent,
    });
  }

  private emitConnectionEvent(
    type: "connectstart" | "connectmove" | "connectend",
    originalEvent?: PointerEvent,
    createdEdgeId: string | null = null,
  ) {
    if (!originalEvent || !this.connectionStartPort) {
      return;
    }

    const targetDraw = this.connectionCandidatePort?.portDraw ?? this.connectionStartPort.portDraw;

    this.eventManager.emit(type, {
      target: this.scene.resolveEventTarget(targetDraw),
      selection: this.scene.getSelectionEventTargets(),
      screenPoint: { ...this.pointerScreen },
      worldPoint: this.renderManager.screenToWorld(this.pointerScreen),
      button: originalEvent.button,
      buttons: originalEvent.buttons,
      modifiers: this.getModifierState(originalEvent),
      connection: this.getConnectionMeta(createdEdgeId),
      originalEvent,
    });
  }

  private getEventTargetKey(target: import("../workflow/Scene.ts").SceneEventTargetDetail) {
    switch (target.kind) {
      case "canvas":
        return "canvas";
      case "edge":
        return `edge:${target.edgeId}`;
      case "node":
        return [
          "node",
          target.nodeId,
          target.item,
          "rowIndex" in target ? target.rowIndex : "",
          "portId" in target ? target.portId : "",
        ].join(":");
    }
  }

  private getModifierState(event: PointerEvent): WorkflowModifierState {
    return {
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    };
  }

  private getDragMeta(): WorkflowDragMeta | undefined {
    if (!this.pendingNodeId) {
      return undefined;
    }

    const nodeDraw = this.scene.getNodeById(this.pendingNodeId);
    const startWorld = this.renderManager.screenToWorld(this.pressStartScreen);
    const currentWorld = this.renderManager.screenToWorld(this.pointerScreen);

    return {
      startScreenPoint: { ...this.pressStartScreen },
      currentScreenPoint: { ...this.pointerScreen },
      deltaScreen: {
        x: this.pointerScreen.x - this.pressStartScreen.x,
        y: this.pointerScreen.y - this.pressStartScreen.y,
      },
      deltaWorld: {
        x: currentWorld.x - startWorld.x,
        y: currentWorld.y - startWorld.y,
      },
      nodePosition: nodeDraw ? { x: nodeDraw.model.x, y: nodeDraw.model.y } : null,
    };
  }

  private getConnectionMeta(createdEdgeId: string | null): WorkflowConnectionMeta | undefined {
    if (!this.connectionStartPort) {
      return undefined;
    }

    const draft = this.resolveEdgeDraft(this.connectionStartPort, this.connectionCandidatePort);

    return {
      state: this.connectionCandidateState,
      reason: this.connectionCandidateReason,
      source: {
        nodeId: this.connectionStartPort.nodeDraw.model.id,
        portId: this.connectionStartPort.port.id,
        direction: this.connectionStartPort.direction,
        dataType: this.connectionStartPort.port.dataType,
      },
      candidate: this.connectionCandidatePort
        ? {
            nodeId: this.connectionCandidatePort.nodeDraw.model.id,
            portId: this.connectionCandidatePort.port.id,
            direction: this.connectionCandidatePort.direction,
            dataType: this.connectionCandidatePort.port.dataType,
          }
        : null,
      draft,
      createdEdgeId,
    };
  }

  private isDragEventType(type: WorkflowEventType) {
    return type === "dragstart" || type === "dragmove" || type === "dragend";
  }

  private updateConnectionPreview() {
    if (!this.connectionStartPort) {
      this.connectionPreviewDraw.clear();
      this.renderManager.requestRender();
      return;
    }

    const pointerWorld = this.renderManager.screenToWorld(this.pointerScreen);
    const edgeDraft = this.resolveEdgeDraft(this.connectionStartPort, this.connectionCandidatePort);
    const isOriginOutput = this.connectionStartPort.direction === "output";
    const originAnchor = this.connectionStartPort.portDraw.getAnchor();
    const targetAnchor =
      this.connectionCandidateState === "valid" && this.connectionCandidatePort
        ? this.connectionCandidatePort.portDraw.getAnchor()
        : pointerWorld;

    const start = isOriginOutput ? originAnchor : targetAnchor;
    const end = isOriginOutput ? targetAnchor : originAnchor;
    const validation = edgeDraft ? this.scene.validateEdgeCandidate(edgeDraft) : null;
    const color =
      this.connectionCandidateState === "valid" && validation?.ok
        ? "#16a34a"
        : this.connectionCandidateState === "invalid"
          ? "#dc2626"
          : getPortTypeColor(this.connectionStartPort.port.dataType);

    this.connectionPreviewDraw.setPreview(start, end, color);
    this.renderManager.requestRender();
  }

  private clearConnectionPreview() {
    this.connectionPreviewDraw.clear();
    this.renderManager.requestRender();
  }

  private syncConnectionInteraction() {
    this.updateConnectionCandidate();
    this.applyConnectionFeedback();
    this.updateConnectionPreview();
  }

  private updateConnectionCandidate() {
    if (!this.connectionStartPort) {
      this.connectionCandidatePort = null;
      this.connectionCandidateState = "none";
      this.connectionCandidateReason = null;
      return;
    }

    const nearestPort = this.getNearestPortCandidate(this.connectionStartPort);

    if (!nearestPort) {
      this.connectionCandidatePort = null;
      this.connectionCandidateState = "none";
      this.connectionCandidateReason = null;
      return;
    }

    const sameDirection = nearestPort.direction === this.connectionStartPort.direction;
    const edgeDraft = this.resolveEdgeDraft(this.connectionStartPort, nearestPort);

    if (!edgeDraft) {
      this.connectionCandidatePort = nearestPort;
      this.connectionCandidateState = "invalid";
      this.connectionCandidateReason = sameDirection
        ? "Links must connect an output port to an input port"
        : "Nodes cannot connect to themselves";
      return;
    }

    const validation = this.scene.validateEdgeCandidate(edgeDraft);
    this.connectionCandidatePort = nearestPort;
    this.connectionCandidateState = validation.ok ? "valid" : "invalid";
    this.connectionCandidateReason = validation.ok ? null : validation.reason;
  }

  private applyConnectionFeedback() {
    const portTargets = this.scene.getPortTargets();

    portTargets.forEach(({ portDraw }) => {
      portDraw.setConnectionState("idle");
    });

    if (!this.connectionStartPort) {
      return;
    }

    this.connectionStartPort.portDraw.setConnectionState("source");

    if (!this.connectionCandidatePort) {
      return;
    }

    this.connectionCandidatePort.portDraw.setConnectionState(
      this.connectionCandidateState === "valid" ? "valid-target" : "invalid-target",
    );
  }

  private clearConnectionFeedback() {
    this.scene.getPortTargets().forEach(({ portDraw }) => {
      portDraw.setConnectionState("idle");
    });
    this.renderManager.requestRender();
  }

  private getNearestPortCandidate(startPort: ScenePortTarget): ScenePortTarget | null {
    let bestTarget: ScenePortTarget | null = null;
    let bestDistance = CONNECTION_SNAP_DISTANCE;

    this.scene.getPortTargets().forEach((target) => {
      if (
        target.nodeDraw.model.id === startPort.nodeDraw.model.id &&
        target.port.id === startPort.port.id &&
        target.direction === startPort.direction
      ) {
        return;
      }

      const anchorScreen = this.renderManager.worldToScreen(target.portDraw.getAnchor());
      const distance = Math.hypot(
        anchorScreen.x - this.pointerScreen.x,
        anchorScreen.y - this.pointerScreen.y,
      );

      if (distance <= bestDistance) {
        bestDistance = distance;
        bestTarget = target;
      }
    });

    return bestTarget;
  }

  private resolveEdgeDraft(
    startPort: ScenePortTarget | null,
    endPort: ScenePortTarget | null,
  ): EdgeDraft | null {
    if (
      !startPort ||
      !endPort ||
      startPort.direction === endPort.direction ||
      startPort.nodeDraw.model.id === endPort.nodeDraw.model.id
    ) {
      return null;
    }

    const outputPort = startPort.direction === "output" ? startPort : endPort;
    const inputPort = startPort.direction === "input" ? startPort : endPort;

    return {
      fromNodeId: outputPort.nodeDraw.model.id,
      fromPortId: outputPort.port.id,
      toNodeId: inputPort.nodeDraw.model.id,
      toPortId: inputPort.port.id,
    };
  }
}
