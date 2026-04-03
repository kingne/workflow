import type { Point } from "../types.ts";
import type { SceneEventTargetDetail } from "../workflow/Scene.ts";

export type WorkflowEventType =
  | "hover"
  | "select"
  | "click"
  | "dragstart"
  | "dragmove"
  | "dragend"
  | "connectstart"
  | "connectmove"
  | "connectend";

export type WorkflowModifierState = {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type WorkflowDragMeta = {
  startScreenPoint: Point;
  currentScreenPoint: Point;
  deltaScreen: Point;
  deltaWorld: Point;
  nodePosition: Point | null;
};

export type WorkflowConnectionMeta = {
  state: "none" | "valid" | "invalid";
  reason: string | null;
  source: {
    nodeId: string;
    portId: string;
    direction: "input" | "output";
    dataType: string;
  };
  candidate: {
    nodeId: string;
    portId: string;
    direction: "input" | "output";
    dataType: string;
  } | null;
  draft:
    | {
        fromNodeId: string;
        fromPortId: string;
        toNodeId: string;
        toPortId: string;
      }
    | null;
  createdEdgeId?: string | null;
};

export type WorkflowEventPayload = {
  type: WorkflowEventType;
  target: SceneEventTargetDetail | null;
  previousTarget?: SceneEventTargetDetail | null;
  selection: SceneEventTargetDetail[];
  screenPoint: Point;
  worldPoint: Point;
  button?: number;
  buttons?: number;
  modifiers: WorkflowModifierState;
  drag?: WorkflowDragMeta;
  connection?: WorkflowConnectionMeta;
  originalEvent?: PointerEvent;
};

type WorkflowEventHandler = (payload: WorkflowEventPayload) => void;

export class EventManager {
  private handlers: Record<WorkflowEventType, WorkflowEventHandler[]> = {
    hover: [],
    select: [],
    click: [],
    dragstart: [],
    dragmove: [],
    dragend: [],
    connectstart: [],
    connectmove: [],
    connectend: [],
  };

  on(type: WorkflowEventType, handler: WorkflowEventHandler) {
    this.handlers[type].push(handler);

    return () => {
      this.handlers[type] = this.handlers[type].filter((current) => current !== handler);
    };
  }

  emit(type: WorkflowEventType, payload: Omit<WorkflowEventPayload, "type">) {
    const event = {
      type,
      ...payload,
    } satisfies WorkflowEventPayload;

    this.handlers[type].forEach((handler) => handler(event));
  }
}
