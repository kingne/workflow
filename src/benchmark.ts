import { GridDraw } from "./draw/GridDraw.ts";
import { EventManager } from "./events/EventManager.ts";
import { History } from "./history/History.ts";
import { KeyControl } from "./input/KeyControl.ts";
import { Mouse } from "./input/Mouse.ts";
import { RenderManager } from "./render/RenderManager.ts";
import type { WorkflowEdgeModel, WorkflowNodeModel } from "./types.ts";
import { Scene } from "./workflow/Scene.ts";
import { Select } from "./workflow/Select.ts";

type BenchmarkOptions = {
  nodeCount: number;
  columns: number;
  runningRatio: number;
  durationMs: number;
  autoPan: boolean;
};

type BenchmarkStats = {
  nodeCount: number;
  edgeCount: number;
  buildMs: number;
  firstPaintMs: number;
  avgFps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  worstFrameMs: number;
  slowFrameRatio: number;
};

const canvas = document.querySelector<HTMLCanvasElement>("#app");

if (!canvas) {
  throw new Error("Canvas element #app was not found.");
}

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("2D rendering context is not supported.");
}

const nodeCountInput = requireElement<HTMLInputElement>("#node-count");
const columnsInput = requireElement<HTMLInputElement>("#columns");
const runningRatioInput = requireElement<HTMLInputElement>("#running-ratio");
const durationInput = requireElement<HTMLInputElement>("#duration-ms");
const autoPanInput = requireElement<HTMLInputElement>("#auto-pan");
const runButton = requireElement<HTMLButtonElement>("#run-benchmark");
const statusElement = requireElement<HTMLElement>("#benchmark-status");
const metricsElement = requireElement<HTMLElement>("#benchmark-metrics");

const renderManager = new RenderManager(canvas, context);
const gridDraw = new GridDraw(
  () => renderManager.getViewportSize(),
  () => renderManager.getViewTransform(),
);

let benchmarkAnimating = false;
let activeScene: Scene | null = null;
let activeMouse: Mouse | null = null;
let activeKeyControl: KeyControl | null = null;

renderManager.setAnimationResolver(() => {
  return benchmarkAnimating || activeScene?.hasActiveAnimations() || false;
});

window.addEventListener("resize", () => {
  renderManager.resize(window.innerWidth, window.innerHeight);
});

runButton.addEventListener("click", () => {
  void runBenchmark(readOptionsFromForm());
});

renderManager.resize(window.innerWidth, window.innerHeight);
void runBenchmark(readOptionsFromForm());

async function runBenchmark(options: BenchmarkOptions) {
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
  const eventManager = new EventManager();
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

  const stats: BenchmarkStats = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    buildMs,
    firstPaintMs,
    avgFps: frameStats.avgFps,
    avgFrameMs: frameStats.avgFrameMs,
    p95FrameMs: frameStats.p95FrameMs,
    worstFrameMs: frameStats.worstFrameMs,
    slowFrameRatio: frameStats.slowFrameRatio,
  };

  statusElement.textContent = "Benchmark completed.";
  renderMetrics(stats, options);
  runButton.disabled = false;
}

function renderMetrics(stats: BenchmarkStats, options: BenchmarkOptions) {
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
    ["Slow Frames > 16.7ms", `${(stats.slowFrameRatio * 100).toFixed(1)}%`],
  ];

  metricsElement.innerHTML = rows
    .map(
      ([label, value]) =>
        `<div class="metric-row"><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong></div>`,
    )
    .join("");
}

async function measureFrameStats(durationMs: number, autoPan: boolean) {
  const frameDurations: number[] = [];
  let previousTime = performance.now();
  let previousPanTime = previousTime;
  let startTime = 0;
  benchmarkAnimating = true;
  renderManager.requestRender();

  await new Promise<void>((resolve) => {
    function step(now: number) {
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
    slowFrameRatio: samples.length > 0 ? slowFrames / samples.length : 0,
  };
}

function createBenchmarkData(options: BenchmarkOptions) {
  const nodes: WorkflowNodeModel[] = [];
  const edges: WorkflowEdgeModel[] = [];
  const columnCount = Math.max(1, options.columns);
  const rowSpacing = 270;
  const columnSpacing = 360;
  const runningCutoff = Math.floor(options.nodeCount * options.runningRatio);

  for (let index = 0; index < options.nodeCount; index += 1) {
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
        { id: "in_meta", label: "Meta", dataType: "json" },
      ],
      outputs: [
        { id: "out_primary", label: "Primary", dataType: "string" },
        { id: "out_meta", label: "Meta", dataType: "json" },
      ],
      parameters: [
        { label: "Model", value: `bench-${(index % 4) + 1}`, tone: "accent" },
        { label: "Batch", value: `${(index % 8) + 1}` },
        { label: "Retries", value: `${index % 3}`, tone: "muted" },
        { label: "Queue", value: `Q-${(index % 12) + 1}`, tone: "muted" },
      ],
      statusLabel: isRunning ? "Running" : "Idle",
      statusTone: isRunning ? "running" : "idle",
      errorText: isRunning ? "Streaming output..." : "Ready",
    });
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const nextIndex = index + 1;
    const belowIndex = index + columnCount;
    const isLastInRow = (index + 1) % columnCount === 0;

    if (nextIndex < nodes.length && !isLastInRow) {
      edges.push({
        id: `bench-edge-${index}-${nextIndex}-primary`,
        fromNodeId: nodes[index]!.id,
        fromPortId: "out_primary",
        toNodeId: nodes[nextIndex]!.id,
        toPortId: "in_primary",
      });
    }

    if (belowIndex < nodes.length) {
      edges.push({
        id: `bench-edge-${index}-${belowIndex}-meta`,
        fromNodeId: nodes[index]!.id,
        fromPortId: "out_meta",
        toNodeId: nodes[belowIndex]!.id,
        toPortId: "in_meta",
      });
    }
  }

  return { nodes, edges };
}

function readOptionsFromForm(): BenchmarkOptions {
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
    autoPan: autoPanInput.checked,
  };
}

function requireElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element ${selector} was not found.`);
  }

  return element;
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value || min)));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function getNodeColor(index: number) {
  const colors = ["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];
  return colors[index % colors.length]!;
}
