export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Size = {
  width: number;
  height: number;
};

export type ViewTransform = {
  x: number;
  y: number;
  scale: number;
};

export type WorkflowTableRow = {
  label: string;
  value: string;
  tone?: "normal" | "accent" | "muted" | "danger";
};

export type WorkflowPortDirection = "input" | "output";

export type WorkflowPortModel = {
  id: string;
  label: string;
  dataType: string;
  description?: string;
};

export type WorkflowNodeModel = {
  id: string;
  title: string;
  logoText: string;
  actionLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  inputs: WorkflowPortModel[];
  outputs: WorkflowPortModel[];
  parameters: WorkflowTableRow[];
  statusLabel: string;
  statusTone: "idle" | "running" | "success" | "error";
  errorText: string;
};

export type WorkflowEdgeModel = {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
};
