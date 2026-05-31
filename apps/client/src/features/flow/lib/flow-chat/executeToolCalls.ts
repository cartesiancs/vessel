import type { ToolCallResult } from "@vessel/capsule-client";
import type { Node, Edge, DataNodeType } from "../../model/types";

export interface ToolExecutionResult {
  toolCallId: string;
  name: string;
  success: boolean;
  message: string;
}

interface FlowStoreActions {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNode: (nodeId: string, data: DataNodeType) => void;
}

function validateEdges(
  edges: Edge[],
  allNodes: Node[],
): { valid: Edge[]; errors: string[] } {
  const valid: Edge[] = [];
  const errors: string[] = [];

  const connectorMap = new Map<string, "in" | "out">();
  for (const node of allNodes) {
    for (const c of node.connectors) {
      connectorMap.set(c.id, c.type as "in" | "out");
    }
  }

  const existingEdgeIds = new Set<string>();

  for (const edge of edges) {
    const sourceType = connectorMap.get(edge.source);
    const targetType = connectorMap.get(edge.target);

    if (!sourceType) {
      errors.push(`Edge ${edge.id}: source connector "${edge.source}" not found`);
      continue;
    }
    if (!targetType) {
      errors.push(`Edge ${edge.id}: target connector "${edge.target}" not found`);
      continue;
    }
    if (sourceType !== "out") {
      errors.push(`Edge ${edge.id}: source "${edge.source}" is not an "out" connector`);
      continue;
    }
    if (targetType !== "in") {
      errors.push(`Edge ${edge.id}: target "${edge.target}" is not an "in" connector`);
      continue;
    }

    const edgeKey = `${edge.source}->${edge.target}`;
    if (existingEdgeIds.has(edgeKey)) {
      errors.push(`Edge ${edge.id}: duplicate connection ${edgeKey}`);
      continue;
    }
    existingEdgeIds.add(edgeKey);
    valid.push(edge);
  }

  return { valid, errors };
}

function executeGenerateFlow(
  args: { nodes: Node[]; edges: Edge[] },
  store: FlowStoreActions,
): ToolExecutionResult & { toolCallId: string } {
  const { valid, errors } = validateEdges(args.edges, args.nodes);

  store.setNodes(args.nodes);
  store.setEdges(valid);

  const msg = errors.length > 0
    ? `Generated flow with ${args.nodes.length} nodes and ${valid.length} edges. ${errors.length} edges skipped: ${errors.join("; ")}`
    : `Generated flow with ${args.nodes.length} nodes and ${valid.length} edges.`;

  return { toolCallId: "", name: "generate_flow", success: true, message: msg };
}

function executeAddNodes(
  args: { nodes: Node[] },
  store: FlowStoreActions,
): ToolExecutionResult & { toolCallId: string } {
  const newNodes = [...store.nodes, ...args.nodes];
  store.setNodes(newNodes);

  return {
    toolCallId: "",
    name: "add_nodes",
    success: true,
    message: `Added ${args.nodes.length} node(s).`,
  };
}

function executeAddEdges(
  args: { edges: Edge[] },
  store: FlowStoreActions,
): ToolExecutionResult & { toolCallId: string } {
  const allNodes = store.nodes;
  const { valid, errors } = validateEdges(args.edges, allNodes);

  // Also check for duplicates with existing edges
  const existingKeys = new Set(
    store.edges.map((e) => `${e.source}->${e.target}`),
  );
  const actuallyNew = valid.filter((e) => {
    const key = `${e.source}->${e.target}`;
    if (existingKeys.has(key)) {
      errors.push(`Edge ${e.id}: already exists`);
      return false;
    }
    return true;
  });

  store.setEdges([...store.edges, ...actuallyNew]);

  const msg = errors.length > 0
    ? `Added ${actuallyNew.length} edge(s). ${errors.length} skipped: ${errors.join("; ")}`
    : `Added ${actuallyNew.length} edge(s).`;

  return { toolCallId: "", name: "add_edges", success: true, message: msg };
}

function executeRemoveNodes(
  args: { node_ids: string[] },
  store: FlowStoreActions,
): ToolExecutionResult & { toolCallId: string } {
  const idsToRemove = new Set(args.node_ids);
  const removedNodes = store.nodes.filter((n) => idsToRemove.has(n.id));
  const removedConnIds = new Set(
    removedNodes.flatMap((n) => n.connectors.map((c) => c.id)),
  );

  store.setNodes(store.nodes.filter((n) => !idsToRemove.has(n.id)));
  store.setEdges(
    store.edges.filter(
      (e) => !removedConnIds.has(e.source) && !removedConnIds.has(e.target),
    ),
  );

  return {
    toolCallId: "",
    name: "remove_nodes",
    success: true,
    message: `Removed ${removedNodes.length} node(s) and their connected edges.`,
  };
}

function executeUpdateNode(
  args: { node_id: string; data: Record<string, unknown> },
  store: FlowStoreActions,
): ToolExecutionResult & { toolCallId: string } {
  const node = store.nodes.find((n) => n.id === args.node_id);
  if (!node) {
    return {
      toolCallId: "",
      name: "update_node",
      success: false,
      message: `Node "${args.node_id}" not found.`,
    };
  }

  store.updateNode(args.node_id, args.data as DataNodeType);

  return {
    toolCallId: "",
    name: "update_node",
    success: true,
    message: `Updated node "${args.node_id}".`,
  };
}

export function executeFlowToolCalls(
  toolCalls: ToolCallResult[],
  store: FlowStoreActions,
): ToolExecutionResult[] {
  const results: ToolExecutionResult[] = [];

  for (const tc of toolCalls) {
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      results.push({
        toolCallId: tc.id,
        name: tc.function.name,
        success: false,
        message: `Failed to parse arguments: invalid JSON`,
      });
      continue;
    }

    let result: ToolExecutionResult;

    switch (tc.function.name) {
      case "generate_flow":
        result = executeGenerateFlow(
          args as { nodes: Node[]; edges: Edge[] },
          store,
        );
        break;
      case "add_nodes":
        result = executeAddNodes(args as { nodes: Node[] }, store);
        break;
      case "add_edges":
        result = executeAddEdges(args as { edges: Edge[] }, store);
        break;
      case "remove_nodes":
        result = executeRemoveNodes(args as { node_ids: string[] }, store);
        break;
      case "update_node":
        result = executeUpdateNode(
          args as { node_id: string; data: Record<string, unknown> },
          store,
        );
        break;
      default:
        result = {
          toolCallId: tc.id,
          name: tc.function.name,
          success: false,
          message: `Unknown tool: ${tc.function.name}`,
        };
    }

    result.toolCallId = tc.id;
    results.push(result);
  }

  return results;
}
