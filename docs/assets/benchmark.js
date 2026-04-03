// src/draw/Draw.ts
class Draw {
  visible = true;
  renderSpace;
  parent = null;
  handlers = {
    mouseenter: [],
    mouseleave: [],
    mousemove: [],
    click: []
  };
  constructor(renderSpace = "world") {
    this.renderSpace = renderSpace;
  }
  draw(context) {
    if (!this.visible) {
      return;
    }
    context.save();
    this.onDraw(context);
    context.restore();
  }
  hitTest(_point) {
    return false;
  }
  findTarget(point) {
    if (!this.visible) {
      return null;
    }
    return this.hitTest(point) ? this : null;
  }
  setParent(parent) {
    this.parent = parent;
  }
  onMouseEnter(handler) {
    this.handlers.mouseenter.push(handler);
    return this;
  }
  onMouseLeave(handler) {
    this.handlers.mouseleave.push(handler);
    return this;
  }
  onMouseMove(handler) {
    this.handlers.mousemove.push(handler);
    return this;
  }
  onClick(handler) {
    this.handlers.click.push(handler);
    return this;
  }
  emit(type, event) {
    this.handlers[type].forEach((handler) => handler(event));
  }
  hasMouseHandlers() {
    return Object.values(this.handlers).some((handlers) => handlers.length > 0);
  }
}

// src/draw/GridDraw.ts
class GridDraw extends Draw {
  getViewportSize;
  getViewTransform;
  options;
  constructor(getViewportSize, getViewTransform, options = {}) {
    super("screen");
    this.getViewportSize = getViewportSize;
    this.getViewTransform = getViewTransform;
    this.options = options;
  }
  onDraw(context) {
    const { width, height } = this.getViewportSize();
    const transform = this.getViewTransform();
    const baseGap = this.options.gap ?? 24;
    const gap = getVisibleGap(baseGap, transform.scale);
    const offsetX = getScreenOffset(transform.x, gap);
    const offsetY = getScreenOffset(transform.y, gap);
    context.fillStyle = this.options.backgroundColor ?? "#f4f7fb";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = this.options.lineColor ?? "rgba(148, 163, 184, 0.16)";
    context.lineWidth = 1;
    for (let x = offsetX;x <= width; x += gap) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = offsetY;y <= height; y += gap) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }
}
function getVisibleGap(baseGap, scale) {
  let visibleGap = baseGap * scale;
  while (visibleGap < 18) {
    visibleGap *= 2;
  }
  return visibleGap;
}
function getScreenOffset(translation, gap) {
  return (translation % gap + gap) % gap;
}

// src/events/EventManager.ts
class EventManager {
  handlers = {
    hover: [],
    select: [],
    click: [],
    dragstart: [],
    dragmove: [],
    dragend: [],
    connectstart: [],
    connectmove: [],
    connectend: []
  };
  on(type, handler) {
    this.handlers[type].push(handler);
    return () => {
      this.handlers[type] = this.handlers[type].filter((current) => current !== handler);
    };
  }
  emit(type, payload) {
    const event = {
      type,
      ...payload
    };
    this.handlers[type].forEach((handler) => handler(event));
  }
}

// src/history/History.ts
class History {
  onChange;
  actions = [];
  cursor = -1;
  constructor(onChange) {
    this.onChange = onChange;
  }
  push(action) {
    this.actions = this.actions.slice(0, this.cursor + 1);
    this.actions.push(action);
    this.cursor = this.actions.length - 1;
    this.onChange?.();
  }
  undo() {
    if (!this.canUndo()) {
      return false;
    }
    const action = this.actions[this.cursor];
    action?.undo();
    this.cursor -= 1;
    this.onChange?.();
    return true;
  }
  redo() {
    if (!this.canRedo()) {
      return false;
    }
    this.cursor += 1;
    const action = this.actions[this.cursor];
    action?.redo();
    this.onChange?.();
    return true;
  }
  canUndo() {
    return this.cursor >= 0;
  }
  canRedo() {
    return this.cursor < this.actions.length - 1;
  }
  getEntries() {
    return [...this.actions];
  }
}

// src/input/KeyControl.ts
class KeyControl {
  callbacks;
  spacePressed = false;
  constructor(callbacks) {
    this.callbacks = callbacks;
  }
  attach() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
  }
  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
  }
  isPanningModifierActive() {
    return this.spacePressed;
  }
  handleKeyDown = (event) => {
    if (event.code === "Space") {
      this.spacePressed = true;
      event.preventDefault();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      this.callbacks.deleteSelection();
      return;
    }
    const hasCommandModifier = event.metaKey || event.ctrlKey;
    if (!hasCommandModifier) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        this.callbacks.redo();
      } else {
        this.callbacks.undo();
      }
      return;
    }
    if (key === "y") {
      event.preventDefault();
      this.callbacks.redo();
    }
  };
  handleKeyUp = (event) => {
    if (event.code === "Space") {
      this.spacePressed = false;
    }
  };
  handleBlur = () => {
    this.spacePressed = false;
  };
}

// src/draw/GroupDraw.ts
class GroupDraw extends Draw {
  children;
  constructor(children = [], renderSpace = "world") {
    super(renderSpace);
    this.children = [];
    this.setChildren(children);
  }
  setChildren(children) {
    this.children.forEach((child) => child.setParent(null));
    this.children = children;
    this.children.forEach((child) => child.setParent(this));
  }
  getChildren() {
    return [...this.children];
  }
  add(child) {
    child.setParent(this);
    this.children.push(child);
  }
  onDraw(context) {
    this.children.forEach((child) => child.draw(context));
  }
  hitTest(point) {
    return this.findTarget(point) !== null;
  }
  findTarget(point) {
    if (!this.visible) {
      return null;
    }
    for (let index = this.children.length - 1;index >= 0; index -= 1) {
      const child = this.children[index];
      if (!child) {
        continue;
      }
      const target = child.findTarget(point);
      if (target) {
        return target;
      }
    }
    if (this.hitTest !== GroupDraw.prototype.hitTest && this.hitTest(point)) {
      return this;
    }
    return null;
  }
}

// src/draw/LineDraw.ts
class LineDraw extends Draw {
  geometry;
  style;
  constructor(geometry, style = {}, renderSpace = "world") {
    super(renderSpace);
    this.geometry = geometry;
    this.style = style;
  }
  setGeometry(geometry) {
    this.geometry = geometry;
  }
  setStyle(style) {
    this.style = { ...this.style, ...style };
  }
  hitTest(point) {
    const threshold = Math.max(6, (this.style.lineWidth ?? 1) + 4);
    if (this.geometry.kind === "polyline") {
      for (let index = 1;index < this.geometry.points.length; index += 1) {
        const start = this.geometry.points[index - 1];
        const end = this.geometry.points[index];
        if (start && end && distanceToSegment(point, start, end) <= threshold) {
          return true;
        }
      }
      return false;
    }
    let previousPoint = this.geometry.start;
    const segments = 24;
    for (let step = 1;step <= segments; step += 1) {
      const t = step / segments;
      const currentPoint = getBezierPoint(this.geometry, t);
      if (distanceToSegment(point, previousPoint, currentPoint) <= threshold) {
        return true;
      }
      previousPoint = currentPoint;
    }
    return false;
  }
  onDraw(context) {
    context.beginPath();
    if (this.geometry.kind === "polyline") {
      const [firstPoint, ...restPoints] = this.geometry.points;
      if (!firstPoint) {
        return;
      }
      context.moveTo(firstPoint.x, firstPoint.y);
      restPoints.forEach((point) => {
        context.lineTo(point.x, point.y);
      });
    } else {
      const { start, control1, control2, end } = this.geometry;
      context.moveTo(start.x, start.y);
      context.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
    }
    context.strokeStyle = this.style.strokeStyle ?? "#475569";
    context.lineWidth = this.style.lineWidth ?? 1;
    context.lineCap = this.style.lineCap ?? "butt";
    context.lineJoin = this.style.lineJoin ?? "miter";
    context.globalAlpha = this.style.globalAlpha ?? 1;
    context.setLineDash(this.style.dash ?? []);
    context.stroke();
  }
}
function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clampedProjection = Math.max(0, Math.min(1, projection));
  const closestX = start.x + dx * clampedProjection;
  const closestY = start.y + dy * clampedProjection;
  return Math.hypot(point.x - closestX, point.y - closestY);
}
function getBezierPoint(geometry, t) {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * inverse * geometry.start.x + 3 * inverse * inverse * t * geometry.control1.x + 3 * inverse * t * t * geometry.control2.x + t * t * t * geometry.end.x,
    y: inverse * inverse * inverse * geometry.start.y + 3 * inverse * inverse * t * geometry.control1.y + 3 * inverse * t * t * geometry.control2.y + t * t * t * geometry.end.y
  };
}

// src/utils/canvas.ts
function createRoundedRectPath(target, x, y, width, height, radius) {
  const boundedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  target.moveTo(x + boundedRadius, y);
  target.lineTo(x + width - boundedRadius, y);
  target.quadraticCurveTo(x + width, y, x + width, y + boundedRadius);
  target.lineTo(x + width, y + height - boundedRadius);
  target.quadraticCurveTo(x + width, y + height, x + width - boundedRadius, y + height);
  target.lineTo(x + boundedRadius, y + height);
  target.quadraticCurveTo(x, y + height, x, y + height - boundedRadius);
  target.lineTo(x, y + boundedRadius);
  target.quadraticCurveTo(x, y, x + boundedRadius, y);
  target.closePath();
}

// src/draw/ShapeDraw.ts
class ShapeDraw extends Draw {
  geometry;
  style;
  constructor(geometry, style = {}, renderSpace = "world") {
    super(renderSpace);
    this.geometry = geometry;
    this.style = style;
  }
  setGeometry(geometry) {
    this.geometry = geometry;
  }
  setStyle(style) {
    this.style = { ...this.style, ...style };
  }
  hitTest(point) {
    if (this.geometry.kind === "rect") {
      const { x, y, width, height } = this.geometry;
      return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
    }
    if (this.geometry.kind === "circle") {
      const offsetX = point.x - this.geometry.x;
      const offsetY = point.y - this.geometry.y;
      return Math.hypot(offsetX, offsetY) <= this.geometry.radius;
    }
    return isPointInPolygon(point, this.geometry.points);
  }
  onDraw(context) {
    const path = this.createPath();
    context.globalAlpha = this.style.globalAlpha ?? 1;
    context.shadowColor = this.style.shadowColor ?? "transparent";
    context.shadowBlur = this.style.shadowBlur ?? 0;
    context.shadowOffsetX = this.style.shadowOffsetX ?? 0;
    context.shadowOffsetY = this.style.shadowOffsetY ?? 0;
    if (this.style.fillStyle) {
      context.fillStyle = this.style.fillStyle;
      context.fill(path);
    }
    if (this.style.strokeStyle) {
      context.strokeStyle = this.style.strokeStyle;
      context.lineWidth = this.style.lineWidth ?? 1;
      context.stroke(path);
    }
  }
  createPath() {
    const path = new Path2D;
    if (this.geometry.kind === "rect") {
      const { x, y, width, height, radius = 0 } = this.geometry;
      createRoundedRectPath(path, x, y, width, height, radius);
      return path;
    }
    if (this.geometry.kind === "circle") {
      path.moveTo(this.geometry.x + this.geometry.radius, this.geometry.y);
      path.arc(this.geometry.x, this.geometry.y, this.geometry.radius, 0, Math.PI * 2);
      path.closePath();
      return path;
    }
    const [firstPoint, ...restPoints] = this.geometry.points;
    if (!firstPoint) {
      return path;
    }
    path.moveTo(firstPoint.x, firstPoint.y);
    restPoints.forEach((point) => {
      path.lineTo(point.x, point.y);
    });
    path.closePath();
    return path;
  }
}
function isPointInPolygon(point, polygon) {
  let isInside = false;
  for (let index = 0, previousIndex = polygon.length - 1;index < polygon.length; previousIndex = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previousIndex];
    if (!currentPoint || !previousPoint) {
      continue;
    }
    const intersects = currentPoint.y > point.y !== previousPoint.y > point.y && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / (previousPoint.y - currentPoint.y || 0.000001) + currentPoint.x;
    if (intersects) {
      isInside = !isInside;
    }
  }
  return isInside;
}

// src/draw/ConnectionPreviewDraw.ts
class ConnectionPreviewDraw extends GroupDraw {
  lineDraw;
  arrowDraw;
  constructor() {
    const lineDraw = new LineDraw({
      kind: "bezier",
      start: { x: 0, y: 0 },
      control1: { x: 0, y: 0 },
      control2: { x: 0, y: 0 },
      end: { x: 0, y: 0 }
    }, {
      strokeStyle: "#2563eb",
      lineWidth: 3,
      lineCap: "round",
      dash: [8, 6],
      globalAlpha: 0.9
    });
    const arrowDraw = new ShapeDraw({
      kind: "polygon",
      points: []
    }, {
      fillStyle: "#2563eb"
    });
    super([lineDraw, arrowDraw]);
    this.lineDraw = lineDraw;
    this.arrowDraw = arrowDraw;
    this.visible = false;
  }
  setPreview(start, end, color) {
    const controlOffset = Math.max(64, Math.abs(end.x - start.x) * 0.5);
    const control1 = { x: start.x + controlOffset, y: start.y };
    const control2 = { x: end.x - controlOffset, y: end.y };
    const tangentX = end.x - control2.x;
    const tangentY = end.y - control2.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const unitX = tangentX / tangentLength;
    const unitY = tangentY / tangentLength;
    const normalX = -unitY;
    const normalY = unitX;
    const arrowLength = 12;
    const arrowWidth = 6;
    this.visible = true;
    this.lineDraw.setGeometry({
      kind: "bezier",
      start,
      control1,
      control2,
      end
    });
    this.lineDraw.setStyle({
      strokeStyle: color
    });
    this.arrowDraw.setGeometry({
      kind: "polygon",
      points: [
        end,
        {
          x: end.x - unitX * arrowLength + normalX * arrowWidth,
          y: end.y - unitY * arrowLength + normalY * arrowWidth
        },
        {
          x: end.x - unitX * arrowLength - normalX * arrowWidth,
          y: end.y - unitY * arrowLength - normalY * arrowWidth
        }
      ]
    });
    this.arrowDraw.setStyle({
      fillStyle: color
    });
  }
  clear() {
    this.visible = false;
  }
  hitTest() {
    return false;
  }
  findTarget(_point) {
    return null;
  }
}

// src/workflow/connection.ts
function getInputPort(node, portId) {
  return node.inputs.find((port) => port.id === portId) ?? null;
}
function getOutputPort(node, portId) {
  return node.outputs.find((port) => port.id === portId) ?? null;
}
function isPortTypeCompatible(sourcePort, targetPort) {
  return sourcePort.dataType === targetPort.dataType;
}
function getPortTypeColor(dataType) {
  const normalizedType = dataType.toLowerCase();
  switch (normalizedType) {
    case "string":
    case "text":
      return "#2563eb";
    case "number":
    case "int":
    case "float":
      return "#dc2626";
    case "boolean":
    case "bool":
      return "#16a34a";
    case "array":
    case "list":
      return "#d97706";
    case "markdown":
    case "md":
      return "#7c3aed";
    case "object":
    case "json":
      return "#0891b2";
    default:
      return "#64748b";
  }
}
function validateEdgeConnection(edge, getNodeById) {
  const sourceNode = getNodeById(edge.fromNodeId);
  const targetNode = getNodeById(edge.toNodeId);
  if (!sourceNode || !targetNode) {
    return {
      ok: false,
      reason: "Node not found"
    };
  }
  const sourcePort = getOutputPort(sourceNode, edge.fromPortId);
  const targetPort = getInputPort(targetNode, edge.toPortId);
  if (!sourcePort || !targetPort) {
    return {
      ok: false,
      reason: "Port not found"
    };
  }
  if (!isPortTypeCompatible(sourcePort, targetPort)) {
    return {
      ok: false,
      reason: `Type mismatch: ${sourcePort.dataType} -> ${targetPort.dataType}`,
      sourcePort,
      targetPort
    };
  }
  return {
    ok: true,
    sourceNode,
    targetNode,
    sourcePort,
    targetPort
  };
}

// src/input/Mouse.ts
var CONNECTION_SNAP_DISTANCE = 28;

class Mouse {
  canvas;
  renderManager;
  scene;
  select;
  keyControl;
  eventManager;
  mode = "idle";
  activePointerId = null;
  pointerScreen = { x: 0, y: 0 };
  lastPointerScreen = { x: 0, y: 0 };
  hoverPath = [];
  pressedTarget = null;
  pressStartScreen = { x: 0, y: 0 };
  pendingNodeId = null;
  nodeDragOffset = { x: 0, y: 0 };
  nodeDragStart = null;
  connectionPreviewDraw = new ConnectionPreviewDraw;
  connectionStartPort = null;
  connectionCandidatePort = null;
  connectionCandidateState = "none";
  connectionCandidateReason = null;
  lastHoverEventTargetKey = "";
  constructor(canvas, renderManager, scene, select, keyControl, eventManager) {
    this.canvas = canvas;
    this.renderManager = renderManager;
    this.scene = scene;
    this.select = select;
    this.keyControl = keyControl;
    this.eventManager = eventManager;
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
  handlePointerDown = (event) => {
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
    if (isMiddleButton || isPrimaryButton && this.keyControl.isPanningModifierActive()) {
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
        y: worldPoint.y - draggableNode.model.y
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
  handlePointerMove = (event) => {
    this.updatePointerScreen(event);
    if (this.activePointerId === null || event.pointerId !== this.activePointerId) {
      this.updateHoverState(event);
      return;
    }
    if (this.mode === "pending-node-drag") {
      const moveDistance = Math.hypot(this.pointerScreen.x - this.pressStartScreen.x, this.pointerScreen.y - this.pressStartScreen.y);
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
        nodeDraw.moveTo(worldPoint.x - this.nodeDragOffset.x, worldPoint.y - this.nodeDragOffset.y);
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
  handlePointerUp = (event) => {
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
        this.scene.commitNodeMove(nodeDraw, this.nodeDragStart, { x: nodeDraw.model.x, y: nodeDraw.model.y });
        this.emitDelegatedEvent("dragend", this.pressedTarget, event);
      }
    } else if (this.mode === "connect-edge") {
      const edgeDraft = this.resolveEdgeDraft(this.connectionStartPort, this.connectionCandidatePort);
      let createdEdgeId = null;
      if (edgeDraft && this.connectionCandidateState === "valid") {
        const createdEdge = this.scene.createEdge(edgeDraft);
        if (!createdEdge) {
          const validation = this.scene.validateEdgeCandidate(edgeDraft);
          console.warn(`Connection rejected: ${validation.reason ?? "Invalid connection"}`);
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
  handleWheel = (event) => {
    event.preventDefault();
    const point = this.getRelativeScreenPoint(event.clientX, event.clientY);
    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    this.renderManager.zoomAt(point, zoomFactor);
  };
  resetPointerState(event) {
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
  updatePointerScreen(event) {
    this.pointerScreen = this.getRelativeScreenPoint(event.clientX, event.clientY);
  }
  getRelativeScreenPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
  updateHoverState(event) {
    const target = this.renderManager.pick(this.pointerScreen);
    const previousEventTarget = this.scene.resolveEventTarget(this.hoverPath[0] ?? null);
    const nextEventTarget = this.scene.resolveEventTarget(target);
    const nextPath = target ? this.getPathToRoot(target) : [];
    const previousPath = this.hoverPath;
    const sharedLength = this.getSharedRootLength(previousPath, nextPath);
    const baseEventTarget = target ?? previousPath[0] ?? null;
    const baseEvent = this.createBaseEvent(baseEventTarget, event);
    for (let index = 0;index < previousPath.length - sharedLength; index += 1) {
      const draw = previousPath[index];
      if (draw && baseEvent) {
        draw.emit("mouseleave", {
          ...baseEvent,
          currentTarget: draw,
          point: this.getPointForDraw(draw, baseEvent)
        });
      }
    }
    for (let index = nextPath.length - sharedLength - 1;index >= 0; index -= 1) {
      const draw = nextPath[index];
      if (draw && baseEvent) {
        draw.emit("mouseenter", {
          ...baseEvent,
          currentTarget: draw,
          point: this.getPointForDraw(draw, baseEvent)
        });
      }
    }
    nextPath.forEach((draw) => {
      if (draw && baseEvent) {
        draw.emit("mousemove", {
          ...baseEvent,
          currentTarget: draw,
          point: this.getPointForDraw(draw, baseEvent)
        });
      }
    });
    this.hoverPath = nextPath;
    this.emitHoverIfChanged(previousEventTarget, nextEventTarget, event);
    this.updateCursor(nextPath);
    this.renderManager.requestRender();
  }
  dispatchClickIfNeeded(releasedTarget, event) {
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
        point: this.getPointForDraw(draw, baseEvent)
      });
    });
    this.emitDelegatedEvent("click", commonTarget, event);
  }
  createBaseEvent(target, originalEvent) {
    if (!target || !originalEvent) {
      return null;
    }
    const screenPoint = { ...this.pointerScreen };
    const worldPoint = this.renderManager.screenToWorld(screenPoint);
    return {
      target,
      screenPoint,
      worldPoint,
      originalEvent
    };
  }
  getPointForDraw(draw, event) {
    return draw.renderSpace === "screen" ? event.screenPoint : event.worldPoint;
  }
  getPathToRoot(draw) {
    const path = [];
    let current = draw;
    while (current) {
      path.push(current);
      current = current.parent;
    }
    return path;
  }
  getSharedRootLength(firstPath, secondPath) {
    let sharedLength = 0;
    while (sharedLength < firstPath.length && sharedLength < secondPath.length && firstPath[firstPath.length - 1 - sharedLength] === secondPath[secondPath.length - 1 - sharedLength]) {
      sharedLength += 1;
    }
    return sharedLength;
  }
  updateCursor(path) {
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
  emitHoverIfChanged(previousTarget, nextTarget, originalEvent) {
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
      originalEvent
    });
  }
  emitSelectEvent(target, originalEvent) {
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
      originalEvent
    });
  }
  emitDelegatedEvent(type, target, originalEvent) {
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
      originalEvent
    });
  }
  emitConnectionEvent(type, originalEvent, createdEdgeId = null) {
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
      originalEvent
    });
  }
  getEventTargetKey(target) {
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
          "portId" in target ? target.portId : ""
        ].join(":");
    }
  }
  getModifierState(event) {
    return {
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey
    };
  }
  getDragMeta() {
    if (!this.pendingNodeId) {
      return;
    }
    const nodeDraw = this.scene.getNodeById(this.pendingNodeId);
    const startWorld = this.renderManager.screenToWorld(this.pressStartScreen);
    const currentWorld = this.renderManager.screenToWorld(this.pointerScreen);
    return {
      startScreenPoint: { ...this.pressStartScreen },
      currentScreenPoint: { ...this.pointerScreen },
      deltaScreen: {
        x: this.pointerScreen.x - this.pressStartScreen.x,
        y: this.pointerScreen.y - this.pressStartScreen.y
      },
      deltaWorld: {
        x: currentWorld.x - startWorld.x,
        y: currentWorld.y - startWorld.y
      },
      nodePosition: nodeDraw ? { x: nodeDraw.model.x, y: nodeDraw.model.y } : null
    };
  }
  getConnectionMeta(createdEdgeId) {
    if (!this.connectionStartPort) {
      return;
    }
    const draft = this.resolveEdgeDraft(this.connectionStartPort, this.connectionCandidatePort);
    return {
      state: this.connectionCandidateState,
      reason: this.connectionCandidateReason,
      source: {
        nodeId: this.connectionStartPort.nodeDraw.model.id,
        portId: this.connectionStartPort.port.id,
        direction: this.connectionStartPort.direction,
        dataType: this.connectionStartPort.port.dataType
      },
      candidate: this.connectionCandidatePort ? {
        nodeId: this.connectionCandidatePort.nodeDraw.model.id,
        portId: this.connectionCandidatePort.port.id,
        direction: this.connectionCandidatePort.direction,
        dataType: this.connectionCandidatePort.port.dataType
      } : null,
      draft,
      createdEdgeId
    };
  }
  isDragEventType(type) {
    return type === "dragstart" || type === "dragmove" || type === "dragend";
  }
  updateConnectionPreview() {
    if (!this.connectionStartPort) {
      this.connectionPreviewDraw.clear();
      this.renderManager.requestRender();
      return;
    }
    const pointerWorld = this.renderManager.screenToWorld(this.pointerScreen);
    const edgeDraft = this.resolveEdgeDraft(this.connectionStartPort, this.connectionCandidatePort);
    const isOriginOutput = this.connectionStartPort.direction === "output";
    const originAnchor = this.connectionStartPort.portDraw.getAnchor();
    const targetAnchor = this.connectionCandidateState === "valid" && this.connectionCandidatePort ? this.connectionCandidatePort.portDraw.getAnchor() : pointerWorld;
    const start = isOriginOutput ? originAnchor : targetAnchor;
    const end = isOriginOutput ? targetAnchor : originAnchor;
    const validation = edgeDraft ? this.scene.validateEdgeCandidate(edgeDraft) : null;
    const color = this.connectionCandidateState === "valid" && validation?.ok ? "#16a34a" : this.connectionCandidateState === "invalid" ? "#dc2626" : getPortTypeColor(this.connectionStartPort.port.dataType);
    this.connectionPreviewDraw.setPreview(start, end, color);
    this.renderManager.requestRender();
  }
  clearConnectionPreview() {
    this.connectionPreviewDraw.clear();
    this.renderManager.requestRender();
  }
  syncConnectionInteraction() {
    this.updateConnectionCandidate();
    this.applyConnectionFeedback();
    this.updateConnectionPreview();
  }
  updateConnectionCandidate() {
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
    const edgeDraft = this.resolveEdgeDraft(this.connectionStartPort, nearestPort);
    if (!edgeDraft) {
      this.connectionCandidatePort = nearestPort;
      this.connectionCandidateState = "invalid";
      this.connectionCandidateReason = nearestPort.direction === this.connectionStartPort.direction ? "Links must connect an output port to an input port" : "Nodes cannot connect to themselves";
      return;
    }
    const validation = this.scene.validateEdgeCandidate(edgeDraft);
    this.connectionCandidatePort = nearestPort;
    this.connectionCandidateState = validation.ok ? "valid" : "invalid";
    this.connectionCandidateReason = validation.ok ? null : validation.reason;
  }
  applyConnectionFeedback() {
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
    this.connectionCandidatePort.portDraw.setConnectionState(this.connectionCandidateState === "valid" ? "valid-target" : "invalid-target");
  }
  clearConnectionFeedback() {
    this.scene.getPortTargets().forEach(({ portDraw }) => {
      portDraw.setConnectionState("idle");
    });
    this.renderManager.requestRender();
  }
  getNearestPortCandidate(startPort) {
    let bestTarget = null;
    let bestDistance = CONNECTION_SNAP_DISTANCE;
    this.scene.getPortTargets().forEach((target) => {
      if (target.nodeDraw.model.id === startPort.nodeDraw.model.id && target.port.id === startPort.port.id && target.direction === startPort.direction) {
        return;
      }
      const anchorScreen = this.renderManager.worldToScreen(target.portDraw.getAnchor());
      const distance = Math.hypot(anchorScreen.x - this.pointerScreen.x, anchorScreen.y - this.pointerScreen.y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        bestTarget = target;
      }
    });
    return bestTarget;
  }
  resolveEdgeDraft(startPort, endPort) {
    if (!startPort || !endPort || startPort.direction === endPort.direction || startPort.nodeDraw.model.id === endPort.nodeDraw.model.id) {
      return null;
    }
    const outputPort = startPort.direction === "output" ? startPort : endPort;
    const inputPort = startPort.direction === "input" ? startPort : endPort;
    return {
      fromNodeId: outputPort.nodeDraw.model.id,
      fromPortId: outputPort.port.id,
      toNodeId: inputPort.nodeDraw.model.id,
      toPortId: inputPort.port.id
    };
  }
}

// src/render/RenderManager.ts
class RenderManager {
  canvas;
  context;
  draws = [];
  frameId = null;
  animationResolver = null;
  viewportSize = { width: 0, height: 0 };
  dpr = 1;
  viewTransform = {
    x: 0,
    y: 0,
    scale: 1
  };
  constructor(canvas, context) {
    this.canvas = canvas;
    this.context = context;
  }
  setDraws(draws) {
    this.draws = draws;
    this.requestRender();
  }
  setAnimationResolver(resolver) {
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
  resize(width, height) {
    this.dpr = Math.max(window.devicePixelRatio || 1, 1);
    this.viewportSize = { width, height };
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.requestRender();
  }
  screenToWorld(point) {
    return {
      x: (point.x - this.viewTransform.x) / this.viewTransform.scale,
      y: (point.y - this.viewTransform.y) / this.viewTransform.scale
    };
  }
  worldToScreen(point) {
    return {
      x: point.x * this.viewTransform.scale + this.viewTransform.x,
      y: point.y * this.viewTransform.scale + this.viewTransform.y
    };
  }
  panBy(deltaX, deltaY) {
    this.viewTransform.x += deltaX;
    this.viewTransform.y += deltaY;
    this.requestRender();
  }
  zoomAt(screenPoint, zoomFactor) {
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
      scale: 1
    };
    this.requestRender();
  }
  fitView(rect, options) {
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
    const scale = clamp(Math.min(availableWidth / safeWidth, availableHeight / safeHeight), minScale, maxScale);
    const contentCenterX = rect.x + rect.width / 2;
    const contentCenterY = rect.y + rect.height / 2;
    this.viewTransform.scale = scale;
    this.viewTransform.x = viewportWidth / 2 - contentCenterX * scale;
    this.viewTransform.y = viewportHeight / 2 - contentCenterY * scale;
    this.requestRender();
  }
  focusRect(rect, options) {
    const { width: viewportWidth, height: viewportHeight } = this.viewportSize;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }
    const targetScale = clamp(options?.scale ?? this.viewTransform.scale, 0.2, options?.maxScale ?? 2.5);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    this.viewTransform.scale = targetScale;
    this.viewTransform.x = viewportWidth / 2 - centerX * targetScale;
    this.viewTransform.y = viewportHeight / 2 - centerY * targetScale;
    this.requestRender();
  }
  pick(screenPoint) {
    const worldPoint = this.screenToWorld(screenPoint);
    for (let index = this.draws.length - 1;index >= 0; index -= 1) {
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
  render() {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let currentSpace = null;
    this.draws.forEach((draw) => {
      if (draw.renderSpace !== currentSpace) {
        currentSpace = draw.renderSpace;
        if (currentSpace === "screen") {
          this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        } else {
          this.context.setTransform(this.dpr * this.viewTransform.scale, 0, 0, this.dpr * this.viewTransform.scale, this.dpr * this.viewTransform.x, this.dpr * this.viewTransform.y);
        }
      }
      draw.draw(this.context);
    });
    if (this.animationResolver?.()) {
      this.scheduleNextFrame();
    }
  }
  scheduleNextFrame() {
    if (this.frameId !== null) {
      return;
    }
    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null;
      this.render();
    });
  }
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// src/draw/RunningEdgeFlowDraw.ts
class RunningEdgeFlowDraw extends Draw {
  active = false;
  color = "#2563eb";
  lineWidth = 3;
  geometry = {
    start: { x: 0, y: 0 },
    control1: { x: 0, y: 0 },
    control2: { x: 0, y: 0 },
    end: { x: 0, y: 0 }
  };
  setGeometry(geometry) {
    this.geometry = geometry;
  }
  setActive(active) {
    this.active = active;
  }
  setColor(color) {
    this.color = color;
  }
  setLineWidth(lineWidth) {
    this.lineWidth = lineWidth;
  }
  hitTest(_point) {
    return false;
  }
  onDraw(context) {
    if (!this.active) {
      return;
    }
    const { start, control1, control2, end } = this.geometry;
    const dashCycle = 22;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
    context.strokeStyle = this.color;
    context.lineWidth = Math.max(2, this.lineWidth - 0.25);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalAlpha = 0.95;
    context.shadowColor = toRgba(this.color, 0.55);
    context.shadowBlur = 10;
    context.setLineDash([12, 10]);
    context.lineDashOffset = -(performance.now() / 45 % dashCycle);
    context.stroke();
  }
}
function toRgba(color, alpha) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const normalized = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
    if (normalized.length === 6) {
      const red = Number.parseInt(normalized.slice(0, 2), 16);
      const green = Number.parseInt(normalized.slice(2, 4), 16);
      const blue = Number.parseInt(normalized.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }
  return color;
}

// src/draw/EdgeDraw.ts
class EdgeDraw extends GroupDraw {
  model;
  getNodeById;
  isHovered = false;
  isSelected = false;
  isRunning = false;
  pathPoints = [];
  lineDraw;
  runningFlowDraw;
  arrowDraw;
  constructor(model, getNodeById) {
    const lineDraw = new LineDraw({
      kind: "bezier",
      start: { x: 0, y: 0 },
      control1: { x: 0, y: 0 },
      control2: { x: 0, y: 0 },
      end: { x: 0, y: 0 }
    }, {
      strokeStyle: "#475569",
      lineWidth: 3,
      lineCap: "round"
    });
    const runningFlowDraw = new RunningEdgeFlowDraw;
    const arrowDraw = new ShapeDraw({
      kind: "polygon",
      points: []
    }, {
      fillStyle: "#475569"
    });
    super([lineDraw, runningFlowDraw, arrowDraw]);
    this.model = model;
    this.getNodeById = getNodeById;
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
      end
    });
    this.runningFlowDraw.setGeometry({
      start,
      control1,
      control2,
      end
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
          y: end.y - unitY * arrowLength + normalY * arrowWidth
        },
        {
          x: end.x - unitX * arrowLength - normalX * arrowWidth,
          y: end.y - unitY * arrowLength - normalY * arrowWidth
        }
      ]
    });
    const edgeColor = getPortTypeColor(validation.sourcePort.dataType);
    const baseLineWidth = this.isSelected ? 5 : this.isHovered ? 4 : 3;
    this.lineDraw.setStyle({
      strokeStyle: this.isRunning ? `${edgeColor}66` : edgeColor,
      lineWidth: baseLineWidth
    });
    this.runningFlowDraw.setColor(edgeColor);
    this.runningFlowDraw.setLineWidth(baseLineWidth);
    this.runningFlowDraw.setActive(this.isRunning);
    this.arrowDraw.setStyle({
      fillStyle: edgeColor,
      shadowColor: this.isRunning ? `${edgeColor}66` : "transparent",
      shadowBlur: this.isRunning ? 10 : 0
    });
    this.pathPoints = [start, control1, control2, end];
  }
  setHovered(isHovered) {
    this.isHovered = isHovered;
    this.refresh();
  }
  setSelected(isSelected) {
    this.isSelected = isSelected;
    this.refresh();
  }
  isAnimating() {
    return this.isRunning;
  }
  intersectsRect(rect) {
    const bounds = this.getBounds();
    return !(rect.x + rect.width < bounds.x || rect.x > bounds.x + bounds.width || rect.y + rect.height < bounds.y || rect.y > bounds.y + bounds.height);
  }
  getBounds() {
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
      height: maxY - minY + padding * 2
    };
  }
}

// src/draw/TextDraw.ts
class TextDraw extends Draw {
  options;
  constructor(options, renderSpace = "world") {
    super(renderSpace);
    this.options = options;
  }
  update(options) {
    this.options = { ...this.options, ...options };
  }
  hitTest(point) {
    const bounds = getTextBounds(this.options);
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }
  onDraw(context) {
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
      globalAlpha = 1
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
var measureContext = document.createElement("canvas").getContext("2d");
function getTextBounds(options) {
  const {
    text,
    x,
    y,
    font = "500 14px sans-serif",
    textAlign = "left",
    textBaseline = "alphabetic",
    maxWidth
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
    height
  };
}
function extractFontSize(font) {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 14;
}

// src/draw/PortDraw.ts
var PORT_RADIUS = 6;

class PortDraw extends GroupDraw {
  port;
  direction;
  isHovered = false;
  connectionState = "idle";
  anchor = { x: 0, y: 0 };
  circleDraw;
  innerDotDraw;
  labelDraw;
  typeDraw;
  constructor(port, direction) {
    const circleDraw = new ShapeDraw({
      kind: "circle",
      x: 0,
      y: 0,
      radius: PORT_RADIUS
    }, {
      fillStyle: "#ffffff",
      strokeStyle: getPortTypeColor(port.dataType),
      lineWidth: 2
    });
    const innerDotDraw = new ShapeDraw({
      kind: "circle",
      x: 0,
      y: 0,
      radius: 2.5
    }, {
      fillStyle: getPortTypeColor(port.dataType)
    });
    const labelDraw = new TextDraw({
      text: port.label,
      x: 0,
      y: 0,
      font: "600 12px sans-serif",
      fillStyle: "#0f172a",
      textBaseline: "middle",
      textAlign: direction === "input" ? "left" : "right"
    });
    const typeDraw = new TextDraw({
      text: port.dataType,
      x: 0,
      y: 0,
      font: "500 11px ui-monospace, SFMono-Regular, Menlo, monospace",
      fillStyle: getPortTypeColor(port.dataType),
      textBaseline: "middle",
      textAlign: direction === "input" ? "left" : "right"
    });
    super([circleDraw, innerDotDraw, labelDraw, typeDraw]);
    this.port = port;
    this.direction = direction;
    this.circleDraw = circleDraw;
    this.innerDotDraw = innerDotDraw;
    this.labelDraw = labelDraw;
    this.typeDraw = typeDraw;
  }
  getPort() {
    return this.port;
  }
  getDirection() {
    return this.direction;
  }
  getAnchor() {
    return { ...this.anchor };
  }
  setHovered(isHovered) {
    this.isHovered = isHovered;
    this.syncStyle();
  }
  setConnectionState(connectionState) {
    this.connectionState = connectionState;
    this.syncStyle();
  }
  updateLayout(layout) {
    this.anchor = {
      x: layout.anchorX,
      y: layout.anchorY
    };
    this.circleDraw.setGeometry({
      kind: "circle",
      x: layout.anchorX,
      y: layout.anchorY,
      radius: PORT_RADIUS
    });
    this.innerDotDraw.setGeometry({
      kind: "circle",
      x: layout.anchorX,
      y: layout.anchorY,
      radius: 2.5
    });
    this.labelDraw.update({
      x: layout.labelX,
      y: layout.labelY,
      maxWidth: layout.maxLabelWidth,
      textAlign: layout.labelAlign
    });
    this.typeDraw.update({
      x: layout.typeX,
      y: layout.typeY,
      maxWidth: layout.maxLabelWidth,
      textAlign: layout.typeAlign
    });
    this.syncStyle();
  }
  hitTest(point) {
    const distance = Math.hypot(point.x - this.anchor.x, point.y - this.anchor.y);
    return distance <= PORT_RADIUS + 10;
  }
  syncStyle() {
    const color = getPortTypeColor(this.port.dataType);
    const feedbackColor = this.connectionState === "valid-target" ? "#16a34a" : this.connectionState === "invalid-target" ? "#dc2626" : this.connectionState === "source" ? color : null;
    const activeColor = feedbackColor ?? color;
    const isActive = this.isHovered || this.connectionState !== "idle";
    const fillStyle = this.connectionState === "invalid-target" ? "#fff5f5" : isActive ? activeColor : "#ffffff";
    const innerFillStyle = this.connectionState === "invalid-target" ? activeColor : isActive ? "#ffffff" : activeColor;
    const labelColor = feedbackColor ?? (this.isHovered ? color : "#0f172a");
    this.circleDraw.setStyle({
      fillStyle,
      strokeStyle: activeColor,
      lineWidth: this.connectionState === "source" ? 2.5 : 2,
      shadowColor: isActive ? `${activeColor}55` : "transparent",
      shadowBlur: isActive ? 10 : 0
    });
    this.innerDotDraw.setStyle({
      fillStyle: innerFillStyle
    });
    this.labelDraw.update({
      fillStyle: labelColor
    });
    this.typeDraw.update({
      fillStyle: feedbackColor ?? color
    });
  }
}

// src/draw/RunningBorderDraw.ts
class RunningBorderDraw extends Draw {
  active = false;
  color = "#2563eb";
  geometry = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    radius: 0
  };
  setGeometry(geometry) {
    this.geometry = geometry;
  }
  setActive(active) {
    this.active = active;
  }
  setColor(color) {
    this.color = color;
  }
  hitTest(_point) {
    return false;
  }
  onDraw(context) {
    if (!this.active) {
      return;
    }
    const { x, y, width, height, radius } = this.geometry;
    const path = new Path2D;
    createRoundedRectPath(path, x, y, width, height, radius);
    const perimeter = getRoundedRectPerimeter(width, height, radius);
    const glowLength = Math.max(44, perimeter * 0.16);
    const gapLength = Math.max(24, perimeter - glowLength);
    const dashOffset = -(performance.now() * 0.18 % perimeter);
    context.strokeStyle = toRgba2(this.color, 0.16);
    context.lineWidth = 2.5;
    context.stroke(path);
    context.strokeStyle = this.color;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = toRgba2(this.color, 0.65);
    context.shadowBlur = 16;
    context.setLineDash([glowLength, gapLength]);
    context.lineDashOffset = dashOffset;
    context.stroke(path);
  }
}
function getRoundedRectPerimeter(width, height, radius) {
  const boundedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  return 2 * (width + height - 4 * boundedRadius) + 2 * Math.PI * boundedRadius;
}
function toRgba2(color, alpha) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const normalized = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
    if (normalized.length === 6) {
      const red = Number.parseInt(normalized.slice(0, 2), 16);
      const green = Number.parseInt(normalized.slice(2, 4), 16);
      const blue = Number.parseInt(normalized.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }
  return color;
}

// src/draw/TableDraw.ts
class TableDraw extends GroupDraw {
  options;
  titleDraw = null;
  frameDraw;
  rowDraws = [];
  rowClickHandlers = [];
  rowMouseEnterHandlers = [];
  rowMouseLeaveHandlers = [];
  constructor(options) {
    const frameDraw = new ShapeDraw({
      kind: "rect",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      radius: 14
    }, {
      fillStyle: "#ffffff",
      strokeStyle: "rgba(148, 163, 184, 0.18)",
      lineWidth: 1
    });
    super([frameDraw]);
    this.options = options;
    this.frameDraw = frameDraw;
    this.sync();
  }
  update(options) {
    this.options = { ...this.options, ...options };
    this.sync();
  }
  getHeight() {
    const titleHeight = this.options.title ? 24 : 0;
    const rowHeight = this.options.rowHeight ?? 34;
    return titleHeight + this.options.rows.length * rowHeight + 18;
  }
  getRowDraw(index) {
    return this.rowDraws[index] ?? null;
  }
  getRowDraws() {
    return [...this.rowDraws];
  }
  resolveRowDraw(target) {
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
  onRowClick(handler) {
    this.rowClickHandlers.push(handler);
    this.rowDraws.forEach((rowDraw) => {
      rowDraw.onClick((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });
    return this;
  }
  onRowMouseEnter(handler) {
    this.rowMouseEnterHandlers.push(handler);
    this.rowDraws.forEach((rowDraw) => {
      rowDraw.onMouseEnter((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });
    return this;
  }
  onRowMouseLeave(handler) {
    this.rowMouseLeaveHandlers.push(handler);
    this.rowDraws.forEach((rowDraw) => {
      rowDraw.onMouseLeave((event) => {
        handler(rowDraw.getRow(), rowDraw.getIndex(), event);
      });
    });
    return this;
  }
  sync() {
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
          textBaseline: "top"
        });
      } else {
        this.titleDraw.update({
          text: title,
          x,
          y
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
      radius: 14
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
          isLastRow
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
        isLastRow
      });
      this.bindRowHandlers(rowDraw);
      return rowDraw;
    });
    const children = [
      ...this.titleDraw ? [this.titleDraw] : [],
      this.frameDraw,
      ...this.rowDraws
    ];
    this.setChildren(children);
  }
  bindRowHandlers(rowDraw) {
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

class TableRowDraw extends GroupDraw {
  hovered = false;
  options;
  backgroundDraw;
  labelDraw;
  valueDraw;
  dividerDraw;
  constructor(options) {
    const backgroundDraw = new ShapeDraw({
      kind: "rect",
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      radius: 0
    }, {});
    const labelDraw = new TextDraw({
      text: options.row.label,
      x: options.x + 14,
      y: options.y + options.height / 2,
      font: "500 12px sans-serif",
      fillStyle: "rgba(71, 85, 105, 0.92)",
      textBaseline: "middle"
    });
    const valueDraw = new TextDraw({
      text: options.row.value,
      x: options.x + options.width - 14,
      y: options.y + options.height / 2,
      font: "500 12px ui-monospace, SFMono-Regular, Menlo, monospace",
      fillStyle: getRowToneColor(options.row.tone),
      textAlign: "right",
      textBaseline: "middle",
      maxWidth: options.width - 130
    });
    const dividerDraw = new LineDraw({
      kind: "polyline",
      points: [
        { x: options.x + 12, y: options.y + options.height },
        { x: options.x + options.width - 12, y: options.y + options.height }
      ]
    }, {
      strokeStyle: "rgba(148, 163, 184, 0.18)",
      lineWidth: 1
    });
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
  update(options) {
    this.options = options;
    this.sync();
  }
  hitTest(point) {
    return point.x >= this.options.x && point.x <= this.options.x + this.options.width && point.y >= this.options.y && point.y <= this.options.y + this.options.height;
  }
  sync() {
    const { row, index, x, y, width, height, isLastRow } = this.options;
    this.backgroundDraw.setGeometry({
      kind: "rect",
      x,
      y,
      width,
      height,
      radius: 0
    });
    this.labelDraw.update({
      text: row.label,
      x: x + 14,
      y: y + height / 2
    });
    this.valueDraw.update({
      text: row.value,
      x: x + width - 14,
      y: y + height / 2,
      fillStyle: getRowToneColor(row.tone),
      maxWidth: width - 130
    });
    this.dividerDraw.visible = !isLastRow;
    this.dividerDraw.setGeometry({
      kind: "polyline",
      points: [
        { x: x + 12, y: y + height },
        { x: x + width - 12, y: y + height }
      ]
    });
    this.syncStyle(index, isLastRow);
  }
  syncStyle(index = this.options.index, isLastRow = this.options.isLastRow) {
    const fillStyle = this.hovered ? "rgba(219, 234, 254, 0.92)" : index % 2 === 0 ? "rgba(248, 250, 252, 0.85)" : "rgba(255, 255, 255, 0.96)";
    this.backgroundDraw.setStyle({
      fillStyle,
      globalAlpha: isLastRow ? 0.96 : 1
    });
    this.labelDraw.update({
      fillStyle: this.hovered ? "#1d4ed8" : "rgba(71, 85, 105, 0.92)"
    });
  }
}
function getRowToneColor(tone) {
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

// src/draw/NodeDraw.ts
var HEADER_HEIGHT = 58;
var FOOTER_HEIGHT = 42;
var CARD_RADIUS = 18;
var CARD_PADDING = 16;
var CONTENT_INSET = 12;
var ACTION_BUTTON_WIDTH = 64;
var ACTION_BUTTON_HEIGHT = 30;
var PORT_ROW_HEIGHT = 38;
var PORT_OUTSIDE_OFFSET = 6;
var PORT_LABEL_WIDTH = 120;

class NodeDraw extends GroupDraw {
  model;
  isDragging = false;
  isHovered = false;
  isSelected = false;
  isHeaderHovered = false;
  isActionHovered = false;
  layoutHeight = 0;
  bodyDraw;
  runningBorderDraw;
  headerGroup;
  headerBackgroundDraw;
  logoDraw;
  logoTextDraw;
  titleDraw;
  dragHintDraw;
  headerDividerDraw;
  actionButtonGroup;
  actionButtonDraw;
  actionButtonTextDraw;
  contentGroup;
  contentBackgroundDraw;
  tableDraw;
  footerGroup;
  footerBackgroundDraw;
  footerDividerDraw;
  footerStatusDotDraw;
  footerStatusTextDraw;
  footerErrorTextDraw;
  inputPortDraws;
  outputPortDraws;
  inputPortSignature = "";
  outputPortSignature = "";
  constructor(model) {
    const bodyDraw = new ShapeDraw({
      kind: "rect",
      x: model.x,
      y: model.y,
      width: model.width,
      height: model.height,
      radius: CARD_RADIUS
    }, {
      fillStyle: "#ffffff"
    });
    const runningBorderDraw = new RunningBorderDraw;
    const headerBackgroundDraw = new ShapeDraw({
      kind: "rect",
      x: model.x + 1,
      y: model.y + 1,
      width: model.width - 2,
      height: HEADER_HEIGHT,
      radius: CARD_RADIUS - 1
    }, {
      fillStyle: "#f8fbff"
    });
    const logoDraw = new ShapeDraw({
      kind: "circle",
      x: 0,
      y: 0,
      radius: 14
    }, {
      fillStyle: model.color
    });
    const logoTextDraw = new TextDraw({
      text: model.logoText,
      x: 0,
      y: 0,
      font: "700 11px sans-serif",
      fillStyle: "#ffffff",
      textAlign: "center",
      textBaseline: "middle"
    });
    const titleDraw = new TextDraw({
      text: model.title,
      x: 0,
      y: 0,
      font: "600 14px sans-serif",
      fillStyle: "#0f172a",
      textBaseline: "middle"
    });
    const dragHintDraw = new TextDraw({
      text: "Drag",
      x: 0,
      y: 0,
      font: "600 11px sans-serif",
      fillStyle: "rgba(37, 99, 235, 0.8)",
      textBaseline: "middle"
    });
    const headerDividerDraw = new LineDraw({
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ]
    }, {
      strokeStyle: "rgba(148, 163, 184, 0.18)",
      lineWidth: 1
    });
    const actionButtonDraw = new ShapeDraw({
      kind: "rect",
      x: 0,
      y: 0,
      width: ACTION_BUTTON_WIDTH,
      height: ACTION_BUTTON_HEIGHT,
      radius: 12
    }, {
      fillStyle: "#ffffff",
      strokeStyle: "rgba(148, 163, 184, 0.28)",
      lineWidth: 1
    });
    const actionButtonTextDraw = new TextDraw({
      text: model.actionLabel,
      x: 0,
      y: 0,
      font: "600 12px sans-serif",
      fillStyle: "#0f172a",
      textAlign: "center",
      textBaseline: "middle"
    });
    const actionButtonGroup = new GroupDraw([actionButtonDraw, actionButtonTextDraw]);
    const headerGroup = new GroupDraw([
      headerBackgroundDraw,
      logoDraw,
      logoTextDraw,
      titleDraw,
      dragHintDraw,
      actionButtonGroup,
      headerDividerDraw
    ]);
    const contentBackgroundDraw = new ShapeDraw({
      kind: "rect",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      radius: 16
    }, {
      fillStyle: "#f8fafc",
      strokeStyle: "rgba(148, 163, 184, 0.18)",
      lineWidth: 1
    });
    const tableDraw = new TableDraw({
      x: 0,
      y: 0,
      width: 0,
      rows: model.parameters,
      title: "Config"
    });
    const inputPortDraws = model.inputs.map((port) => createNodePortDraw(port, "input"));
    const outputPortDraws = model.outputs.map((port) => createNodePortDraw(port, "output"));
    const contentGroup = new GroupDraw([
      contentBackgroundDraw,
      ...inputPortDraws,
      tableDraw,
      ...outputPortDraws
    ]);
    const footerBackgroundDraw = new ShapeDraw({
      kind: "rect",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      radius: 12
    }, {
      fillStyle: "rgba(255, 255, 255, 0.001)"
    });
    const footerDividerDraw = new LineDraw({
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ]
    }, {
      strokeStyle: "rgba(148, 163, 184, 0.18)",
      lineWidth: 1
    });
    const footerStatusDotDraw = new ShapeDraw({
      kind: "circle",
      x: 0,
      y: 0,
      radius: 4
    }, {
      fillStyle: "#94a3b8"
    });
    const footerStatusTextDraw = new TextDraw({
      text: model.statusLabel,
      x: 0,
      y: 0,
      font: "600 12px sans-serif",
      fillStyle: "#0f172a",
      textBaseline: "middle"
    });
    const footerErrorTextDraw = new TextDraw({
      text: model.errorText,
      x: 0,
      y: 0,
      font: "500 12px sans-serif",
      fillStyle: "rgba(220, 38, 38, 0.95)",
      textAlign: "right",
      textBaseline: "middle",
      maxWidth: 180
    });
    const footerGroup = new GroupDraw([
      footerBackgroundDraw,
      footerDividerDraw,
      footerStatusDotDraw,
      footerStatusTextDraw,
      footerErrorTextDraw
    ]);
    super([bodyDraw, headerGroup, contentGroup, footerGroup, runningBorderDraw]);
    this.model = model;
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
    this.headerGroup.onMouseEnter(() => {
      this.isHeaderHovered = true;
      this.syncFromModel();
    }).onMouseLeave(() => {
      this.isHeaderHovered = false;
      this.syncFromModel();
    });
    this.actionButtonGroup.onMouseEnter(() => {
      this.isActionHovered = true;
      this.syncFromModel();
    }).onMouseLeave(() => {
      this.isActionHovered = false;
      this.syncFromModel();
    });
    this.syncFromModel();
  }
  getHeight() {
    return this.layoutHeight;
  }
  moveTo(x, y) {
    this.model.x = x;
    this.model.y = y;
    this.syncFromModel();
  }
  setDragging(isDragging) {
    this.isDragging = isDragging;
    this.syncFromModel();
  }
  setHovered(isHovered) {
    this.isHovered = isHovered;
    this.syncFromModel();
  }
  setSelected(isSelected) {
    this.isSelected = isSelected;
    this.syncFromModel();
  }
  isRunning() {
    return this.model.statusTone === "running";
  }
  isDraggableTarget(target) {
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
  getInputPort(portId) {
    return getInputPort(this.model, portId);
  }
  getOutputPort(portId) {
    return getOutputPort(this.model, portId);
  }
  getInputPortAnchor(portId) {
    return this.inputPortDraws.find((portDraw) => portDraw.getPort().id === portId)?.getAnchor() ?? null;
  }
  getOutputPortAnchor(portId) {
    return this.outputPortDraws.find((portDraw) => portDraw.getPort().id === portId)?.getAnchor() ?? null;
  }
  getPortDraws() {
    return [...this.inputPortDraws, ...this.outputPortDraws];
  }
  resolveEventItem(target) {
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
        dataType: port.dataType
      };
    }
    const outputPortDraw = this.outputPortDraws.find((portDraw) => this.isDrawInside(target, portDraw));
    if (outputPortDraw) {
      const port = outputPortDraw.getPort();
      return {
        item: "output-port",
        portId: port.id,
        portLabel: port.label,
        dataType: port.dataType
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
    const portSectionHeight = Math.max(this.model.inputs.length, this.model.outputs.length, 1) * PORT_ROW_HEIGHT + 18;
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
      radius: CARD_RADIUS
    });
    this.bodyDraw.setStyle({
      fillStyle: "#ffffff",
      strokeStyle: this.isSelected ? "rgba(37, 99, 235, 0.9)" : this.isHovered ? "rgba(37, 99, 235, 0.26)" : "rgba(148, 163, 184, 0.12)",
      lineWidth: this.isSelected ? 2.5 : this.isHovered ? 2 : 1,
      shadowColor: "rgba(15, 23, 42, 0.12)",
      shadowBlur: this.isDragging ? 30 : this.isSelected ? 24 : this.isHovered ? 22 : 18,
      shadowOffsetY: this.isDragging ? 16 : this.isSelected ? 14 : this.isHovered ? 12 : 10
    });
    this.runningBorderDraw.setGeometry({
      x: x - 1.5,
      y: y - 1.5,
      width: width + 3,
      height,
      radius: CARD_RADIUS + 1.5
    });
    this.runningBorderDraw.setColor(this.model.color);
    this.runningBorderDraw.setActive(this.isRunning());
    this.headerBackgroundDraw.setGeometry({
      kind: "rect",
      x: x + 1,
      y: y + 1,
      width: width - 2,
      height: HEADER_HEIGHT,
      radius: CARD_RADIUS - 1
    });
    this.headerBackgroundDraw.setStyle({
      fillStyle: dragHintVisible ? "rgba(239, 246, 255, 0.96)" : "rgba(248, 250, 252, 0.96)"
    });
    this.logoDraw.setGeometry({
      kind: "circle",
      x: x + CARD_PADDING + 14,
      y: headerCenterY,
      radius: 14
    });
    this.logoDraw.setStyle({
      fillStyle: this.model.color
    });
    this.logoTextDraw.update({
      text: this.model.logoText,
      x: x + CARD_PADDING + 14,
      y: headerCenterY
    });
    this.titleDraw.update({
      text: this.model.title,
      x: x + CARD_PADDING + 38,
      y: headerCenterY,
      fillStyle: dragHintVisible ? "#1d4ed8" : "#0f172a",
      maxWidth: width - CARD_PADDING * 2 - ACTION_BUTTON_WIDTH - 76
    });
    this.dragHintDraw.visible = dragHintVisible;
    this.dragHintDraw.update({
      x: actionX - 16,
      y: headerCenterY,
      textAlign: "right"
    });
    this.actionButtonDraw.setGeometry({
      kind: "rect",
      x: actionX,
      y: actionY,
      width: ACTION_BUTTON_WIDTH,
      height: ACTION_BUTTON_HEIGHT,
      radius: 12
    });
    this.actionButtonDraw.setStyle({
      fillStyle: this.isActionHovered ? "#0f172a" : "#ffffff",
      strokeStyle: this.isActionHovered ? "#0f172a" : "rgba(148, 163, 184, 0.28)",
      lineWidth: 1
    });
    this.actionButtonTextDraw.update({
      text: this.model.actionLabel,
      x: actionX + ACTION_BUTTON_WIDTH / 2,
      y: actionY + ACTION_BUTTON_HEIGHT / 2,
      fillStyle: this.isActionHovered ? "#ffffff" : "#0f172a"
    });
    this.headerDividerDraw.setGeometry({
      kind: "polyline",
      points: [
        { x: x + 14, y: y + HEADER_HEIGHT },
        { x: x + width - 14, y: y + HEADER_HEIGHT }
      ]
    });
    this.contentBackgroundDraw.setGeometry({
      kind: "rect",
      x: contentX,
      y: contentY,
      width: contentWidth,
      height: contentHeight,
      radius: 16
    });
    this.contentBackgroundDraw.setStyle({
      fillStyle: "#f8fafc",
      strokeStyle: "rgba(148, 163, 184, 0.16)",
      lineWidth: 1
    });
    this.tableDraw.update({
      x: tableX,
      y: contentY + 12,
      width: tableWidth,
      rows: this.model.parameters,
      title: "Config"
    });
    this.layoutPorts(this.inputPortDraws, inputAnchorX, contentY + 24, contentHeight, "input");
    this.layoutPorts(this.outputPortDraws, outputAnchorX, contentY + 24, contentHeight, "output");
    this.footerDividerDraw.setGeometry({
      kind: "polyline",
      points: [
        { x: x + 14, y: footerY },
        { x: x + width - 14, y: footerY }
      ]
    });
    const footerCenterY = footerY + FOOTER_HEIGHT / 2 + 1;
    this.footerBackgroundDraw.setGeometry({
      kind: "rect",
      x: x + CARD_PADDING,
      y: footerY,
      width: width - CARD_PADDING * 2,
      height: FOOTER_HEIGHT,
      radius: 12
    });
    this.footerStatusDotDraw.setGeometry({
      kind: "circle",
      x: x + CARD_PADDING + 4,
      y: footerCenterY,
      radius: 4
    });
    this.footerStatusDotDraw.setStyle({
      fillStyle: getStatusColor(this.model.statusTone)
    });
    this.footerStatusTextDraw.update({
      text: this.model.statusLabel,
      x: x + CARD_PADDING + 16,
      y: footerCenterY,
      fillStyle: getStatusColor(this.model.statusTone)
    });
    this.footerErrorTextDraw.update({
      text: this.model.errorText,
      x: x + width - CARD_PADDING,
      y: footerCenterY,
      fillStyle: this.model.statusTone === "error" ? "#dc2626" : "rgba(100, 116, 139, 0.9)",
      maxWidth: width - 150
    });
  }
  hitTest(point) {
    return point.x >= this.model.x && point.x <= this.model.x + this.model.width && point.y >= this.model.y && point.y <= this.model.y + this.layoutHeight;
  }
  intersectsRect(rect) {
    const bounds = this.getBounds();
    return !(rect.x + rect.width < bounds.x || rect.x > bounds.x + bounds.width || rect.y + rect.height < bounds.y || rect.y > bounds.y + bounds.height);
  }
  getBounds() {
    return {
      x: this.model.x,
      y: this.model.y,
      width: this.model.width,
      height: this.layoutHeight
    };
  }
  layoutPorts(portDraws, anchorX, contentTopY, contentHeight, side) {
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
        typeAlign: side === "input" ? "right" : "left"
      });
    });
  }
  isDrawInside(target, container) {
    let current = target;
    while (current) {
      if (current === container) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
  syncPortDrawsFromModel() {
    const nextInputSignature = getPortSignature(this.model.inputs);
    const nextOutputSignature = getPortSignature(this.model.outputs);
    if (nextInputSignature === this.inputPortSignature && nextOutputSignature === this.outputPortSignature) {
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
      ...this.outputPortDraws
    ]);
  }
}
function getPortSignature(ports) {
  return ports.map((port) => `${port.id}:${port.label}:${port.dataType}:${port.description ?? ""}`).join("|");
}
function createNodePortDraw(port, direction) {
  const portDraw = new PortDraw(port, direction);
  portDraw.onMouseEnter(() => {
    portDraw.setHovered(true);
  }).onMouseLeave(() => {
    portDraw.setHovered(false);
  });
  return portDraw;
}
function getTableRowDetail(rowDraw) {
  const row = rowDraw.getRow();
  return {
    item: "table-row",
    rowIndex: rowDraw.getIndex(),
    rowLabel: row.label,
    rowValue: row.value
  };
}
function getStatusColor(statusTone) {
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

// src/workflow/Scene.ts
class Scene {
  history;
  worldLayer = new GroupDraw;
  worldOverlayLayer = new GroupDraw;
  screenLayer = new GroupDraw([], "screen");
  nodeDraws;
  edgeDraws;
  nodeDrawMap;
  selectedItems = new Set;
  constructor(nodeModels, edgeModels, history) {
    this.history = history;
    this.nodeDraws = nodeModels.map((node) => new NodeDraw(node));
    this.nodeDrawMap = new Map(this.nodeDraws.map((nodeDraw) => [nodeDraw.model.id, nodeDraw]));
    this.edgeDraws = edgeModels.filter((edge) => {
      const validation = validateEdgeConnection(edge, (id) => this.getNodeById(id)?.model ?? null);
      if (!validation.ok) {
        console.warn(`Invalid edge ${edge.id}: ${validation.reason}`);
        return false;
      }
      return true;
    }).map((edge) => new EdgeDraw(edge, (id) => this.getNodeById(id)));
    this.refreshEdges();
    this.syncWorldLayer();
  }
  getRenderLayers() {
    return [this.worldLayer, this.worldOverlayLayer, this.screenLayer];
  }
  setWorldOverlayDraws(draws) {
    this.worldOverlayLayer.setChildren(draws);
  }
  setScreenDraws(draws) {
    this.screenLayer.setChildren(draws);
  }
  getNodeDraws() {
    return [...this.nodeDraws];
  }
  getEdgeDraws() {
    return [...this.edgeDraws];
  }
  getNodeById(id) {
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
      height: maxY - minY
    };
  }
  getNodeBounds(nodeId) {
    return this.getNodeById(nodeId)?.getBounds() ?? null;
  }
  updateNodeStatus(nodeId, status, options) {
    const nodeDraw = this.getNodeById(nodeId);
    if (!nodeDraw) {
      return false;
    }
    nodeDraw.model.statusTone = status;
    nodeDraw.model.statusLabel = options?.statusLabel ?? getDefaultStatusLabel(status);
    nodeDraw.model.errorText = options?.errorText ?? (status === "error" ? "Runtime error" : status === "running" ? "Streaming output..." : "Ready");
    this.syncFromModels();
    return true;
  }
  getPortTargets() {
    return this.nodeDraws.flatMap((nodeDraw) => nodeDraw.getPortDraws().map((portDraw) => ({
      nodeDraw,
      portDraw,
      direction: portDraw.getDirection(),
      port: portDraw.getPort()
    })));
  }
  resolveEventTarget(draw) {
    if (!draw) {
      return {
        kind: "canvas",
        item: "canvas",
        nodeId: null,
        edgeId: null
      };
    }
    const selectable = this.resolveSelectable(draw);
    if (selectable instanceof NodeDraw) {
      return {
        kind: "node",
        nodeId: selectable.model.id,
        edgeId: null,
        ...selectable.resolveEventItem(draw)
      };
    }
    if (selectable instanceof EdgeDraw) {
      return {
        kind: "edge",
        item: "edge",
        nodeId: null,
        edgeId: selectable.model.id
      };
    }
    return {
      kind: "canvas",
      item: "canvas",
      nodeId: null,
      edgeId: null
    };
  }
  getSelectionEventTargets() {
    return this.getSelection().map((item) => this.describeSelectable(item));
  }
  resolvePortTarget(draw) {
    let current = draw;
    let portDraw = null;
    let nodeDraw = null;
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
      port: portDraw.getPort()
    };
  }
  resolveSelectable(draw) {
    let current = draw;
    while (current) {
      if (current instanceof NodeDraw || current instanceof EdgeDraw) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }
  getDraggableNode(draw) {
    const selectable = this.resolveSelectable(draw);
    if (!(selectable instanceof NodeDraw)) {
      return null;
    }
    return selectable.isDraggableTarget(draw) ? selectable : null;
  }
  focusNode(nodeId) {
    const nodeDraw = this.getNodeById(nodeId);
    if (!nodeDraw) {
      return null;
    }
    this.moveNodeToFront(nodeDraw);
    this.selectOnly(nodeDraw);
    return nodeDraw.getBounds();
  }
  moveNodeToFront(targetNode) {
    const index = this.nodeDraws.findIndex((nodeDraw2) => nodeDraw2.model.id === targetNode.model.id);
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
    return this.nodeDraws.some((nodeDraw) => nodeDraw.isRunning()) || this.edgeDraws.some((edgeDraw) => edgeDraw.isAnimating());
  }
  syncFromModels() {
    this.nodeDraws.forEach((nodeDraw) => nodeDraw.syncFromModel());
    this.edgeDraws = this.edgeDraws.filter((edgeDraw) => {
      const validation = validateEdgeConnection(edgeDraw.model, (id) => this.getNodeById(id)?.model ?? null);
      if (!validation.ok) {
        this.selectedItems.delete(edgeDraw);
      }
      return validation.ok;
    });
    this.applySelectionStyles();
    this.refreshEdges();
    this.syncWorldLayer();
  }
  setSelection(items) {
    this.selectedItems = new Set(items);
    this.applySelectionStyles();
  }
  selectOnly(item) {
    this.setSelection(item ? [item] : []);
  }
  clearSelection() {
    this.setSelection([]);
  }
  getSelection() {
    return [...this.selectedItems];
  }
  selectInRect(rect) {
    const selectedItems = [
      ...this.nodeDraws.filter((nodeDraw) => nodeDraw.intersectsRect(rect)),
      ...this.edgeDraws.filter((edgeDraw) => edgeDraw.intersectsRect(rect))
    ];
    this.setSelection(selectedItems);
    return selectedItems;
  }
  validateEdgeCandidate(edge) {
    const duplicatedEdge = this.edgeDraws.find((edgeDraw) => edgeDraw.model.fromNodeId === edge.fromNodeId && edgeDraw.model.fromPortId === edge.fromPortId && edgeDraw.model.toNodeId === edge.toNodeId && edgeDraw.model.toPortId === edge.toPortId);
    if (duplicatedEdge) {
      return {
        ok: false,
        reason: "Connection already exists"
      };
    }
    return validateEdgeConnection({
      id: "__preview__",
      ...edge
    }, (id) => this.getNodeById(id)?.model ?? null);
  }
  createEdge(edgeDraft) {
    const validation = this.validateEdgeCandidate(edgeDraft);
    if (!validation.ok) {
      return null;
    }
    const previousSelection = this.getSelection();
    const edgeDraw = new EdgeDraw({
      id: createEdgeId(),
      ...edgeDraft
    }, (id) => this.getNodeById(id));
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
      redo: applyCreate
    });
    return edgeDraw;
  }
  createNode(nodeModel) {
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
      redo: applyCreate
    });
    return nodeDraw;
  }
  deleteSelection() {
    const selectedItems = this.getSelection();
    if (selectedItems.length === 0) {
      return false;
    }
    const selectedNodes = selectedItems.filter((item) => item instanceof NodeDraw);
    const selectedEdges = new Set(selectedItems.filter((item) => item instanceof EdgeDraw));
    selectedNodes.forEach((nodeDraw) => {
      this.edgeDraws.forEach((edgeDraw) => {
        if (edgeDraw.model.fromNodeId === nodeDraw.model.id || edgeDraw.model.toNodeId === nodeDraw.model.id) {
          selectedEdges.add(edgeDraw);
        }
      });
    });
    const deletedNodeSnapshots = selectedNodes.map((draw) => ({
      draw,
      index: this.nodeDraws.indexOf(draw)
    })).filter((snapshot) => snapshot.index >= 0).sort((left, right) => left.index - right.index);
    const deletedEdgeSnapshots = [...selectedEdges].map((draw) => ({
      draw,
      index: this.edgeDraws.indexOf(draw)
    })).filter((snapshot) => snapshot.index >= 0).sort((left, right) => left.index - right.index);
    const applyDelete = () => {
      deletedEdgeSnapshots.slice().sort((left, right) => right.index - left.index).forEach(({ draw, index }) => {
        this.edgeDraws.splice(index, 1);
        this.selectedItems.delete(draw);
      });
      deletedNodeSnapshots.slice().sort((left, right) => right.index - left.index).forEach(({ draw, index }) => {
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
        ...deletedEdgeSnapshots.map((snapshot) => snapshot.draw)
      ]);
      this.refreshEdges();
      this.syncWorldLayer();
    };
    applyDelete();
    this.history.push({
      label: "Delete selection",
      undo: restoreDelete,
      redo: applyDelete
    });
    return true;
  }
  commitNodeMove(nodeDraw, from, to) {
    if (from.x === to.x && from.y === to.y) {
      return false;
    }
    const applyMove = (point) => {
      nodeDraw.moveTo(point.x, point.y);
      this.refreshEdges();
      this.syncWorldLayer();
    };
    this.history.push({
      label: "Move node",
      undo: () => applyMove(from),
      redo: () => applyMove(to)
    });
    return true;
  }
  applySelectionStyles() {
    this.nodeDraws.forEach((nodeDraw) => {
      nodeDraw.setSelected(this.selectedItems.has(nodeDraw));
    });
    this.edgeDraws.forEach((edgeDraw) => {
      edgeDraw.setSelected(this.selectedItems.has(edgeDraw));
    });
  }
  describeSelectable(item) {
    if (item instanceof NodeDraw) {
      return {
        kind: "node",
        nodeId: item.model.id,
        edgeId: null,
        item: "node"
      };
    }
    return {
      kind: "edge",
      item: "edge",
      nodeId: null,
      edgeId: item.model.id
    };
  }
  syncWorldLayer() {
    this.worldLayer.setChildren([...this.edgeDraws, ...this.nodeDraws]);
  }
}
function getDefaultStatusLabel(status) {
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

// src/draw/SelectionBoxDraw.ts
class SelectionBoxDraw extends Draw {
  rect = null;
  constructor() {
    super("screen");
    this.visible = false;
  }
  setRect(rect) {
    this.rect = rect;
    this.visible = rect !== null;
  }
  onDraw(context) {
    if (!this.rect) {
      return;
    }
    context.fillStyle = "rgba(37, 99, 235, 0.08)";
    context.strokeStyle = "rgba(37, 99, 235, 0.9)";
    context.lineWidth = 1;
    context.setLineDash([6, 4]);
    context.fillRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
    context.strokeRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
  }
}

// src/workflow/Select.ts
class Select {
  scene;
  renderManager;
  boxDraw = new SelectionBoxDraw;
  startScreenPoint = null;
  currentScreenPoint = null;
  selecting = false;
  constructor(scene, renderManager) {
    this.scene = scene;
    this.renderManager = renderManager;
    this.scene.setScreenDraws([this.boxDraw]);
  }
  begin(screenPoint) {
    this.startScreenPoint = { ...screenPoint };
    this.currentScreenPoint = { ...screenPoint };
    this.selecting = false;
    this.updateDraw();
  }
  update(screenPoint) {
    if (!this.startScreenPoint) {
      return;
    }
    this.currentScreenPoint = { ...screenPoint };
    const screenRect = this.getScreenRect();
    if (!screenRect) {
      return;
    }
    this.selecting = screenRect.width > 4 || screenRect.height > 4;
    this.updateDraw();
    if (this.selecting) {
      this.scene.selectInRect(this.getWorldRect(screenRect));
    }
  }
  end() {
    const wasSelecting = this.selecting;
    this.startScreenPoint = null;
    this.currentScreenPoint = null;
    this.selecting = false;
    this.updateDraw();
    return wasSelecting;
  }
  selectByDraw(draw) {
    const item = this.scene.resolveSelectable(draw);
    this.scene.selectOnly(item);
    return item;
  }
  clearSelection() {
    this.scene.clearSelection();
  }
  updateDraw() {
    this.boxDraw.setRect(this.selecting ? this.getScreenRect() : null);
  }
  getScreenRect() {
    if (!this.startScreenPoint || !this.currentScreenPoint) {
      return null;
    }
    return normalizeRect({
      x: this.startScreenPoint.x,
      y: this.startScreenPoint.y,
      width: this.currentScreenPoint.x - this.startScreenPoint.x,
      height: this.currentScreenPoint.y - this.startScreenPoint.y
    });
  }
  getWorldRect(screenRect) {
    const topLeft = this.renderManager.screenToWorld({ x: screenRect.x, y: screenRect.y });
    const bottomRight = this.renderManager.screenToWorld({
      x: screenRect.x + screenRect.width,
      y: screenRect.y + screenRect.height
    });
    return normalizeRect({
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    });
  }
}
function normalizeRect(rect) {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;
  return {
    x,
    y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height)
  };
}

// src/benchmark.ts
var canvas = document.querySelector("#app");
if (!canvas) {
  throw new Error("Canvas element #app was not found.");
}
var context = canvas.getContext("2d");
if (!context) {
  throw new Error("2D rendering context is not supported.");
}
var nodeCountInput = requireElement("#node-count");
var columnsInput = requireElement("#columns");
var runningRatioInput = requireElement("#running-ratio");
var durationInput = requireElement("#duration-ms");
var autoPanInput = requireElement("#auto-pan");
var runButton = requireElement("#run-benchmark");
var statusElement = requireElement("#benchmark-status");
var metricsElement = requireElement("#benchmark-metrics");
var renderManager = new RenderManager(canvas, context);
var gridDraw = new GridDraw(() => renderManager.getViewportSize(), () => renderManager.getViewTransform());
var benchmarkAnimating = false;
var activeScene = null;
var activeMouse = null;
var activeKeyControl = null;
renderManager.setAnimationResolver(() => {
  return benchmarkAnimating || activeScene?.hasActiveAnimations() || false;
});
window.addEventListener("resize", () => {
  renderManager.resize(window.innerWidth, window.innerHeight);
});
runButton.addEventListener("click", () => {
  runBenchmark(readOptionsFromForm());
});
renderManager.resize(window.innerWidth, window.innerHeight);
runBenchmark(readOptionsFromForm());
async function runBenchmark(options) {
  runButton.disabled = true;
  statusElement.textContent = "Preparing benchmark scene...";
  metricsElement.innerHTML = "";
  activeMouse?.destroy();
  activeKeyControl?.destroy();
  const buildStart = performance.now();
  const { nodes, edges } = createBenchmarkData(options);
  const history = new History(() => {
    renderManager.requestRender();
  });
  const scene = new Scene(nodes, edges, history);
  const select = new Select(scene, renderManager);
  const eventManager = new EventManager;
  const keyControl = new KeyControl({
    deleteSelection: () => {
      if (scene.deleteSelection()) {
        renderManager.requestRender();
      }
    },
    undo: () => {
      if (history.undo()) {
        renderManager.requestRender();
      }
    },
    redo: () => {
      if (history.redo()) {
        renderManager.requestRender();
      }
    }
  });
  const mouse = new Mouse(canvas, renderManager, scene, select, keyControl, eventManager);
  const buildMs = performance.now() - buildStart;
  activeScene = scene;
  activeMouse = mouse;
  activeKeyControl = keyControl;
  renderManager.resetView();
  renderManager.setDraws([gridDraw, ...scene.getRenderLayers()]);
  keyControl.attach();
  mouse.attach();
  const firstPaintStart = performance.now();
  renderManager.requestRender();
  await nextFrame();
  const firstPaintMs = performance.now() - firstPaintStart;
  statusElement.textContent = `Running ${options.durationMs}ms benchmark...`;
  const frameStats = await measureFrameStats(options.durationMs, options.autoPan);
  const stats = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    buildMs,
    firstPaintMs,
    avgFps: frameStats.avgFps,
    avgFrameMs: frameStats.avgFrameMs,
    p95FrameMs: frameStats.p95FrameMs,
    worstFrameMs: frameStats.worstFrameMs,
    slowFrameRatio: frameStats.slowFrameRatio
  };
  statusElement.textContent = "Benchmark completed.";
  renderMetrics(stats, options);
  runButton.disabled = false;
}
function renderMetrics(stats, options) {
  const rows = [
    ["Nodes", String(stats.nodeCount)],
    ["Edges", String(stats.edgeCount)],
    ["Columns", String(options.columns)],
    ["Running Ratio", `${Math.round(options.runningRatio * 100)}%`],
    ["Build Time", `${stats.buildMs.toFixed(1)} ms`],
    ["First Paint", `${stats.firstPaintMs.toFixed(1)} ms`],
    ["Average FPS", stats.avgFps.toFixed(1)],
    ["Average Frame", `${stats.avgFrameMs.toFixed(2)} ms`],
    ["P95 Frame", `${stats.p95FrameMs.toFixed(2)} ms`],
    ["Worst Frame", `${stats.worstFrameMs.toFixed(2)} ms`],
    ["Slow Frames > 16.7ms", `${(stats.slowFrameRatio * 100).toFixed(1)}%`]
  ];
  metricsElement.innerHTML = rows.map(([label, value]) => `<div class="metric-row"><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong></div>`).join("");
}
async function measureFrameStats(durationMs, autoPan) {
  const frameDurations = [];
  let previousTime = performance.now();
  let previousPanTime = previousTime;
  let startTime = 0;
  benchmarkAnimating = true;
  renderManager.requestRender();
  await new Promise((resolve) => {
    function step(now) {
      if (startTime === 0) {
        startTime = now;
      }
      frameDurations.push(now - previousTime);
      previousTime = now;
      if (autoPan) {
        const deltaMs = now - previousPanTime;
        previousPanTime = now;
        renderManager.panBy(deltaMs * 0.045, Math.sin(now / 400) * 0.4);
      }
      if (now - startTime < durationMs) {
        window.requestAnimationFrame(step);
        return;
      }
      resolve();
    }
    window.requestAnimationFrame(step);
  });
  benchmarkAnimating = false;
  const samples = frameDurations.slice(1);
  const total = samples.reduce((sum, value) => sum + value, 0);
  const avgFrameMs = total / Math.max(samples.length, 1);
  const avgFps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const p95FrameMs = sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] ?? 0;
  const worstFrameMs = sorted.at(-1) ?? 0;
  const slowFrames = samples.filter((value) => value > 16.7).length;
  return {
    avgFps,
    avgFrameMs,
    p95FrameMs,
    worstFrameMs,
    slowFrameRatio: samples.length > 0 ? slowFrames / samples.length : 0
  };
}
function createBenchmarkData(options) {
  const nodes = [];
  const edges = [];
  const columnCount = Math.max(1, options.columns);
  const rowSpacing = 270;
  const columnSpacing = 360;
  const runningCutoff = Math.floor(options.nodeCount * options.runningRatio);
  for (let index = 0;index < options.nodeCount; index += 1) {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;
    const isRunning = index < runningCutoff;
    nodes.push({
      id: `bench-node-${index}`,
      title: `Worker ${index + 1}`,
      logoText: `N${(index + 1).toString().slice(-2)}`,
      actionLabel: "Run",
      x: 140 + column * columnSpacing,
      y: 120 + row * rowSpacing,
      width: 300,
      height: 240,
      color: getNodeColor(index),
      inputs: [
        { id: "in_primary", label: "Primary", dataType: "string" },
        { id: "in_meta", label: "Meta", dataType: "json" }
      ],
      outputs: [
        { id: "out_primary", label: "Primary", dataType: "string" },
        { id: "out_meta", label: "Meta", dataType: "json" }
      ],
      parameters: [
        { label: "Model", value: `bench-${index % 4 + 1}`, tone: "accent" },
        { label: "Batch", value: `${index % 8 + 1}` },
        { label: "Retries", value: `${index % 3}`, tone: "muted" },
        { label: "Queue", value: `Q-${index % 12 + 1}`, tone: "muted" }
      ],
      statusLabel: isRunning ? "Running" : "Idle",
      statusTone: isRunning ? "running" : "idle",
      errorText: isRunning ? "Streaming output..." : "Ready"
    });
  }
  for (let index = 0;index < nodes.length; index += 1) {
    const nextIndex = index + 1;
    const belowIndex = index + columnCount;
    const isLastInRow = (index + 1) % columnCount === 0;
    if (nextIndex < nodes.length && !isLastInRow) {
      edges.push({
        id: `bench-edge-${index}-${nextIndex}-primary`,
        fromNodeId: nodes[index].id,
        fromPortId: "out_primary",
        toNodeId: nodes[nextIndex].id,
        toPortId: "in_primary"
      });
    }
    if (belowIndex < nodes.length) {
      edges.push({
        id: `bench-edge-${index}-${belowIndex}-meta`,
        fromNodeId: nodes[index].id,
        fromPortId: "out_meta",
        toNodeId: nodes[belowIndex].id,
        toPortId: "in_meta"
      });
    }
  }
  return { nodes, edges };
}
function readOptionsFromForm() {
  const nodeCount = clampInteger(Number(nodeCountInput.value), 10, 5000);
  const columns = clampInteger(Number(columnsInput.value), 1, 50);
  const runningRatio = clampNumber(Number(runningRatioInput.value), 0, 1);
  const durationMs = clampInteger(Number(durationInput.value), 1000, 15000);
  nodeCountInput.value = String(nodeCount);
  columnsInput.value = String(columns);
  runningRatioInput.value = String(runningRatio);
  durationInput.value = String(durationMs);
  return {
    nodeCount,
    columns,
    runningRatio,
    durationMs,
    autoPan: autoPanInput.checked
  };
}
function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element ${selector} was not found.`);
  }
  return element;
}
function nextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value || min)));
}
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
function getNodeColor(index) {
  const colors = ["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];
  return colors[index % colors.length];
}
