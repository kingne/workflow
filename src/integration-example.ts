import { WorkflowApp } from "./index.ts";
import type { WorkflowEdgeModel, WorkflowNodeModel, WorkflowPortModel } from "./types.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#app");
const status = document.querySelector<HTMLElement>("#integration-status");
const logElement = document.querySelector<HTMLElement>("#integration-log");
const startButton = document.querySelector<HTMLButtonElement>("#start-app");
const destroyButton = document.querySelector<HTMLButtonElement>("#destroy-app");
const focusButton = document.querySelector<HTMLButtonElement>("#focus-review");
const toggleStatusButton = document.querySelector<HTMLButtonElement>("#toggle-review-status");
const updateNodeButton = document.querySelector<HTMLButtonElement>("#update-start-node");
const togglePortButton = document.querySelector<HTMLButtonElement>("#toggle-tone-output");
const createNodeButton = document.querySelector<HTMLButtonElement>("#create-insight-node");

if (!canvas || !status || !logElement) {
  throw new Error("Integration example DOM was not found.");
}

let app: WorkflowApp | null = null;

function createNodes(): WorkflowNodeModel[] {
  return [
    {
      id: "prompt",
      title: "Prompt Builder",
      logoText: "PB",
      actionLabel: "Run",
      x: 120,
      y: 140,
      width: 440,
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
        { label: "Model", value: "gpt-5.4-mini" },
        { label: "Temperature", value: "0.20", tone: "muted" },
        { label: "Output Schema", value: "prompt + meta + tone", tone: "accent" },
      ],
      statusLabel: "Running",
      statusTone: "running",
      errorText: "Streaming prompt assembly",
    },
    {
      id: "review",
      title: "Response Reviewer",
      logoText: "RV",
      actionLabel: "Run",
      x: 700,
      y: 240,
      width: 440,
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
        { label: "Model", value: "gpt-5.4" },
        { label: "Threshold", value: "strict", tone: "muted" },
        { label: "Reviewer", value: "safety + quality", tone: "accent" },
      ],
      statusLabel: "Ready",
      statusTone: "idle",
      errorText: "",
    },
  ];
}

function createEdges(): WorkflowEdgeModel[] {
  return [
    {
      id: "edge-prompt-review-draft",
      fromNodeId: "prompt",
      fromPortId: "prompt",
      toNodeId: "review",
      toPortId: "draft",
    },
    {
      id: "edge-prompt-review-meta",
      fromNodeId: "prompt",
      fromPortId: "meta",
      toNodeId: "review",
      toPortId: "meta",
    },
    {
      id: "edge-prompt-review-tone",
      fromNodeId: "prompt",
      fromPortId: "tonePreset",
      toNodeId: "review",
      toPortId: "tone",
    },
  ];
}

function mountApp() {
  if (app) {
    return app;
  }

  app = new WorkflowApp({
    canvas,
    nodes: createNodes(),
    edges: createEdges(),
    autoFitView: true,
    fitViewPadding: 110,
  });

  app.on("click", (event) => {
    log(`[click] ${formatTarget(event.target)}`);
  });

  app.on("dragstart", (event) => {
    log(`[dragstart] ${formatTarget(event.target)}`);
  });

  app.on("connectend", (event) => {
    const state = event.connection?.state ?? "idle";
    const detail = event.connection?.createdEdgeId ? ` -> ${event.connection.createdEdgeId}` : "";
    log(`[connectend] ${state}${detail}`);
  });

  app.start();
  updateStatus("App started");
  syncButtons();
  return app;
}

function unmountApp() {
  app?.destory();
  app = null;
  updateStatus("App destroyed");
  syncButtons();
}

function updatePromptNode() {
  const current = mountApp().getNode("prompt");

  if (!current) {
    return;
  }

  const nextVersion = current.title.endsWith("v2") ? "Prompt Builder" : "Prompt Builder v2";
  mountApp().updateNode("prompt", {
    title: nextVersion,
    statusLabel: "Updated",
    statusTone: "success",
    errorText: nextVersion.endsWith("v2") ? "Node updated from host app" : "",
    parameters: current.parameters.map((row) =>
      row.label === "Model"
        ? { ...row, value: nextVersion.endsWith("v2") ? "gpt-5.4" : "gpt-5.4-mini" }
        : row,
    ),
  });
  log(`[updateNode] prompt -> ${nextVersion}`);
}

function toggleReviewRunning() {
  const current = mountApp().getNode("review");

  if (!current) {
    return;
  }

  const running = current.statusTone === "running";
  mountApp().updateNode("review", {
    statusLabel: running ? "Ready" : "Running",
    statusTone: running ? "idle" : "running",
    errorText: running ? "" : "Reviewing generated response",
  });
  log(`[updateNode] review.statusTone -> ${running ? "idle" : "running"}`);
}

function toggleToneOutput() {
  const current = mountApp().getNode("prompt");

  if (!current) {
    return;
  }

  const hasTonePort = current.outputs.some((port) => port.id === "tonePreset");
  const nextOutputs = hasTonePort
    ? current.outputs.filter((port) => port.id !== "tonePreset")
    : [...current.outputs, createTonePort()];
  const nextParameters = current.parameters.map((row) =>
    row.label === "Output Schema"
      ? {
          ...row,
          value: hasTonePort ? "prompt + meta" : "prompt + meta + tone",
        }
      : row,
  );

  mountApp().updateNode("prompt", {
    outputs: nextOutputs,
    parameters: nextParameters,
    statusLabel: hasTonePort ? "Ports updated" : "Tone enabled",
    statusTone: "success",
    errorText: hasTonePort ? "Tone output removed by host app" : "Tone output restored by host app",
  });
  log(`[updateNode] prompt.outputs -> ${hasTonePort ? "remove tonePreset" : "add tonePreset"}`);
}

function focusReview() {
  if (mountApp().focusNode("review", { scale: 1.15 })) {
    log("[focusNode] review");
  }
}

function createInsightNode() {
  const existing = mountApp().getNode("insight");

  if (existing) {
    mountApp().focusNode("insight", { scale: 1.1 });
    log("[createNode] insight already exists");
    return;
  }

  const created = mountApp().createNode(
    {
      id: "insight",
      title: "Insight Ranker",
      logoText: "IR",
      actionLabel: "Run",
      x: 1120,
      y: 128,
      width: 420,
      height: 280,
      color: "#7c3aed",
      inputs: [
        { id: "notes", label: "Notes", dataType: "list" },
        { id: "score", label: "Score", dataType: "number" },
      ],
      outputs: [{ id: "summary", label: "Summary", dataType: "markdown" }],
      parameters: [
        { label: "Model", value: "gpt-5.4-mini" },
        { label: "Strategy", value: "top-k rerank", tone: "muted" },
      ],
      statusLabel: "Ready",
      statusTone: "idle",
      errorText: "",
    },
    { focus: true },
  );

  if (created) {
    log("[createNode] insight");
  }
}

function createTonePort(): WorkflowPortModel {
  return { id: "tonePreset", label: "Tone", dataType: "string" };
}

function formatTarget(target: { nodeId?: string; item?: string; rowLabel?: string; portId?: string } | null | undefined) {
  if (!target) {
    return "canvas";
  }

  const suffix = target.rowLabel ?? target.portId ?? "";
  return [target.nodeId, target.item, suffix].filter(Boolean).join(".");
}

function log(message: string) {
  const lines = logElement.textContent ? logElement.textContent.split("\n").filter(Boolean) : [];
  lines.unshift(`${new Date().toLocaleTimeString("zh-CN", { hour12: false })}  ${message}`);
  logElement.textContent = lines.slice(0, 10).join("\n");
}

function updateStatus(text: string) {
  status.textContent = text;
}

function syncButtons() {
  const running = Boolean(app);

  if (startButton) {
    startButton.disabled = running;
  }

  if (destroyButton) {
    destroyButton.disabled = !running;
  }

  if (focusButton) {
    focusButton.disabled = !running;
  }

  if (toggleStatusButton) {
    toggleStatusButton.disabled = !running;
  }

  if (updateNodeButton) {
    updateNodeButton.disabled = !running;
  }

  if (togglePortButton) {
    togglePortButton.disabled = !running;
  }

  if (createNodeButton) {
    createNodeButton.disabled = !running;
  }
}

startButton?.addEventListener("click", () => {
  mountApp();
});

destroyButton?.addEventListener("click", () => {
  unmountApp();
});

focusButton?.addEventListener("click", () => {
  focusReview();
});

toggleStatusButton?.addEventListener("click", () => {
  toggleReviewRunning();
});

updateNodeButton?.addEventListener("click", () => {
  updatePromptNode();
});

togglePortButton?.addEventListener("click", () => {
  toggleToneOutput();
});

createNodeButton?.addEventListener("click", () => {
  createInsightNode();
});

mountApp();
