import { GridDraw } from "./draw/GridDraw.ts";
import { GroupDraw } from "./draw/GroupDraw.ts";
import { TextDraw } from "./draw/TextDraw.ts";
import { EventManager } from "./events/EventManager.ts";
import { History } from "./history/History.ts";
import { KeyControl } from "./input/KeyControl.ts";
import { Mouse } from "./input/Mouse.ts";
import { RenderManager } from "./render/RenderManager.ts";
import type { WorkflowEdgeModel, WorkflowNodeModel } from "./types.ts";
import { Scene } from "./workflow/Scene.ts";
import { Select } from "./workflow/Select.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#app");

if (!canvas) {
  throw new Error("Canvas element #app was not found.");
}

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("2D rendering context is not supported.");
}

const renderManager = new RenderManager(canvas, context);
const eventManager = new EventManager();
const history = new History(() => {
  renderManager.requestRender();
});

const nodes: WorkflowNodeModel[] = [
  {
    id: "start",
    title: "Prompt Builder",
    logoText: "PB",
    actionLabel: "Run",
    x: 120,
    y: 140,
    width: 460,
    height: 320,
    color: "#2563eb",
    inputs: [
      { id: "query", label: "Query", dataType: "string" },
      { id: "context", label: "Context", dataType: "json" },
    ],
    outputs: [
      { id: "prompt", label: "Prompt", dataType: "markdown" },
      { id: "meta", label: "Meta", dataType: "json" },
      { id: "tonePreset", label: "Tone", dataType: "string" },
    ],
    parameters: [
      { label: "Input Schema", value: "query + context", tone: "muted" },
      { label: "Output Schema", value: "prompt + meta + tone", tone: "accent" },
      { label: "Model", value: "gpt-5.4-mini" },
      { label: "Temperature", value: "0.20", tone: "muted" },
      { label: "Max Tokens", value: "2048", tone: "muted" },
    ],
    statusLabel: "Running",
    statusTone: "running",
    errorText: "Awaiting upstream context",
  },
  {
    id: "review",
    title: "Response Reviewer",
    logoText: "RV",
    actionLabel: "Run",
    x: 560,
    y: 240,
    width: 460,
    height: 320,
    color: "#0f766e",
    inputs: [
      { id: "draft", label: "Draft", dataType: "markdown" },
      { id: "meta", label: "Meta", dataType: "json" },
      { id: "tone", label: "Tone", dataType: "string" },
    ],
    outputs: [
      { id: "notes", label: "Notes", dataType: "list" },
      { id: "score", label: "Score", dataType: "number" },
    ],
    parameters: [
      { label: "Input Schema", value: "draft + meta + tone", tone: "muted" },
      { label: "Output Schema", value: "notes + score", tone: "accent" },
      { label: "Model", value: "gpt-5.4" },
      { label: "Threshold", value: "strict", tone: "muted" },
      { label: "Retries", value: "1", tone: "muted" },
    ],
    statusLabel: "Running",
    statusTone: "running",
    errorText: "Missing required field: tone",
  },
];

const edges: WorkflowEdgeModel[] = [
  {
    id: "edge-start-review",
    fromNodeId: "start",
    fromPortId: "prompt",
    toNodeId: "review",
    toPortId: "draft",
  },
  {
    id: "edge-start-review-meta",
    fromNodeId: "start",
    fromPortId: "meta",
    toNodeId: "review",
    toPortId: "meta",
  },
];

const scene = new Scene(nodes, edges, history);
renderManager.setAnimationResolver(() => scene.hasActiveAnimations());
const select = new Select(scene, renderManager);
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
  },
});

const gridDraw = new GridDraw(
  () => renderManager.getViewportSize(),
  () => renderManager.getViewTransform(),
);
const titleTextDraw = new TextDraw(
  {
    text: "Canvas Workflow Demo",
    x: 24,
    y: 30,
    font: "500 14px sans-serif",
    fillStyle: "rgba(15, 23, 42, 0.7)",
    textBaseline: "top",
  },
  "screen",
);
const helperTextDraw = new TextDraw(
  {
    text: "Click here to fit view. Prompt Builder.Run toggles the Tone output. Response Reviewer.Run toggles that node between running and idle so you can verify the running animation.",
    x: 24,
    y: 52,
    font: "500 14px sans-serif",
    fillStyle: "rgba(15, 23, 42, 0.55)",
    textBaseline: "top",
  },
  "screen",
);
const overlayDraw = new GroupDraw([titleTextDraw, helperTextDraw], "screen");
scene.getNodeDraws().forEach((nodeDraw) => {
  nodeDraw
    .onMouseEnter(() => {
      nodeDraw.setHovered(true);
      renderManager.requestRender();
    })
    .onMouseLeave(() => {
      nodeDraw.setHovered(false);
      renderManager.requestRender();
    });

  nodeDraw.getActionButtonDraw().onClick(() => {
    if (nodeDraw.model.id === "start") {
      const hasToneOutput = nodeDraw.model.outputs.some((port) => port.id === "tonePreset");

      nodeDraw.model.outputs = hasToneOutput
        ? nodeDraw.model.outputs.filter((port) => port.id !== "tonePreset")
        : [
            ...nodeDraw.model.outputs,
            { id: "tonePreset", label: "Tone", dataType: "string" },
          ];

      nodeDraw.model.parameters = nodeDraw.model.parameters.map((row) =>
        row.label === "Output Schema"
          ? {
              ...row,
              value: hasToneOutput ? "prompt + meta" : "prompt + meta + tone",
            }
          : row,
      );

      scene.syncFromModels();
      renderManager.requestRender();
      console.log(`Toggled start.tonePreset output: ${hasToneOutput ? "off" : "on"}`);
      return;
    }

    if (nodeDraw.model.id === "review") {
      const nextStatus = nodeDraw.model.statusTone === "running" ? "idle" : "running";
      scene.updateNodeStatus(nodeDraw.model.id, nextStatus, {
        errorText: nextStatus === "running" ? "Streaming output..." : "Ready",
      });
      renderManager.requestRender();
      console.log(`Toggled review status: ${nextStatus}`);
      return;
    }

    console.log(`Action clicked: ${nodeDraw.model.id}`);
  });

  nodeDraw.getContentDraw().onClick(() => {
    console.log(`Content clicked: ${nodeDraw.model.id}`);
  });

  nodeDraw.getTableDraw().onRowClick((row) => {
    console.log(`Row clicked: ${nodeDraw.model.id}.${row.label}`);
  });

  nodeDraw.getFooterDraw().onClick(() => {
    const focusBounds = scene.focusNode(nodeDraw.model.id);

    if (focusBounds) {
      renderManager.focusRect(focusBounds, {
        scale: Math.max(renderManager.getViewTransform().scale, 1),
      });
    }

    console.log(`Footer clicked: ${nodeDraw.model.id}`);
  });
});

scene.getEdgeDraws().forEach((edgeDraw) => {
  edgeDraw
    .onMouseEnter(() => {
      edgeDraw.setHovered(true);
      renderManager.requestRender();
    })
    .onMouseLeave(() => {
      edgeDraw.setHovered(false);
      renderManager.requestRender();
    })
    .onClick(() => {
      console.log(`Edge clicked: ${edgeDraw.model.id}`);
    });
});

titleTextDraw
  .onMouseEnter(() => {
    titleTextDraw.update({ fillStyle: "#2563eb" });
    renderManager.requestRender();
  })
  .onMouseLeave(() => {
    titleTextDraw.update({ fillStyle: "rgba(15, 23, 42, 0.7)" });
    renderManager.requestRender();
  });

helperTextDraw
  .onMouseEnter(() => {
    helperTextDraw.update({ fillStyle: "#2563eb" });
    renderManager.requestRender();
  })
  .onMouseLeave(() => {
    helperTextDraw.update({ fillStyle: "rgba(15, 23, 42, 0.55)" });
    renderManager.requestRender();
  })
  .onClick(() => {
    const bounds = scene.getWorldBounds();

    if (bounds) {
      renderManager.fitView(bounds, { padding: 100 });
    } else {
      renderManager.resetView();
    }
  });

const mouse = new Mouse(canvas, renderManager, scene, select, keyControl, eventManager);

window.addEventListener("resize", () => {
  renderManager.resize(window.innerWidth, window.innerHeight);
});

renderManager.setDraws([gridDraw, ...scene.getRenderLayers(), overlayDraw]);
keyControl.attach();
mouse.attach();
renderManager.resize(window.innerWidth, window.innerHeight);

const initialBounds = scene.getWorldBounds();

if (initialBounds) {
  renderManager.fitView(initialBounds, { padding: 120 });
}
