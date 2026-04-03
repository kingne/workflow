import type { WorkflowEdgeModel, WorkflowNodeModel, WorkflowPortModel } from "../types.ts";

export function getInputPort(node: WorkflowNodeModel, portId: string) {
  return node.inputs.find((port) => port.id === portId) ?? null;
}

export function getOutputPort(node: WorkflowNodeModel, portId: string) {
  return node.outputs.find((port) => port.id === portId) ?? null;
}

export function isPortTypeCompatible(sourcePort: WorkflowPortModel, targetPort: WorkflowPortModel) {
  return sourcePort.dataType === targetPort.dataType;
}

export function getPortTypeColor(dataType: string) {
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

export function validateEdgeConnection(
  edge: WorkflowEdgeModel,
  getNodeById: (id: string) => WorkflowNodeModel | null,
) {
  const sourceNode = getNodeById(edge.fromNodeId);
  const targetNode = getNodeById(edge.toNodeId);

  if (!sourceNode || !targetNode) {
    return {
      ok: false as const,
      reason: "Node not found",
    };
  }

  const sourcePort = getOutputPort(sourceNode, edge.fromPortId);
  const targetPort = getInputPort(targetNode, edge.toPortId);

  if (!sourcePort || !targetPort) {
    return {
      ok: false as const,
      reason: "Port not found",
    };
  }

  if (!isPortTypeCompatible(sourcePort, targetPort)) {
    return {
      ok: false as const,
      reason: `Type mismatch: ${sourcePort.dataType} -> ${targetPort.dataType}`,
      sourcePort,
      targetPort,
    };
  }

  return {
    ok: true as const,
    sourceNode,
    targetNode,
    sourcePort,
    targetPort,
  };
}
