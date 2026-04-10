import type { Node, Edge } from "@/features/flow/flowTypes";
import type { Flow } from "@/entities/flow/types";
import { DEFINITION_NODE } from "@/features/flow/flowNode";

export function buildFlowSystemPrompt(
  currentNodes: Node[],
  currentEdges: Edge[],
  availableFlows: Flow[],
  currentFlowName: string | null,
): string {
  const nodeSchemas = Object.entries(DEFINITION_NODE).map(([type, def]) => {
    const connectors = def.connectors.map(
      (c: { name: string; type: string }) => `${c.name}(${c.type})`,
    );
    const dataFields = def.data
      ? Object.entries(def.data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      : [];
    const dataTypeFields = def.dataType
      ? Object.entries(def.dataType).map(([k, v]) => `${k}: ${v}`)
      : [];

    return [
      `- ${type}`,
      `  connectors: [${connectors.join(", ")}]`,
      dataFields.length > 0
        ? `  data defaults: {${dataFields.join(", ")}}`
        : null,
      dataTypeFields.length > 0
        ? `  data types: {${dataTypeFields.join(", ")}}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const flowsList = availableFlows
    .map((f) => `- ${f.name} (id: ${f.id})`)
    .join("\n");

  const currentGraph =
    currentNodes.length > 0
      ? JSON.stringify({ nodes: currentNodes, edges: currentEdges }, null, 2)
      : "(empty)";

  return `You are a flow builder assistant, a visual node-based automation platform.
Your job is to create or modify flows by calling the provided tools.

## Available Node Types

${nodeSchemas.join("\n\n")}

## ID Generation Rules

- Node ID: \`{NODE_TYPE}-{timestamp}\` (e.g. \`INTERVAL-1709876543210\`)
  Use Date.now() style timestamps. Each node MUST have a unique ID.
- Connector ID: \`{nodeId}-{connectorType}{index}\` (e.g. \`INTERVAL-1709876543210-out0\`)
  connectorType is "in" or "out", index is 0-based position in the connectors array.

## Edge Rules

- \`source\` must be an "out" type connector ID
- \`target\` must be an "in" type connector ID
- Edge ID: \`{source}-{target}\`

## Node Position Layout Rules

- Layout nodes left-to-right following data flow direction
- Start position: (100, 100)
- Horizontal gap between nodes: 250px
- Vertical gap between parallel nodes: 150px
- Node dimensions: width=120, height=50

## Current State

Current flow: ${currentFlowName ?? "(none selected)"}

Registered flows:
${flowsList || "(none)"}

Current graph:
${currentGraph}

## Instructions

- Always use tools to modify the flow. Never describe changes in plain text.
- When generating a complete flow, use the \`generate_flow\` tool.
- When adding to an existing flow, use \`add_nodes\` and \`add_edges\`.
- When modifying, use \`update_node\` or \`remove_nodes\`.
- Ensure all edges connect valid connector IDs with correct in/out types.
- After tool execution, briefly summarize what was done.`;
}
