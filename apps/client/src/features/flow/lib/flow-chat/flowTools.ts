import type { Tool } from "@vessel/capsule-client";

export const FLOW_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "generate_flow",
      description:
        "Generate a complete flow graph by replacing all nodes and edges. Use this when creating a new flow from scratch or completely rebuilding the current flow.",
      parameters: {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            description: "Array of flow nodes",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique node ID (format: {NODE_TYPE}-{timestamp})" },
                title: { type: "string", description: "Display title (same as id)" },
                x: { type: "number", description: "X position" },
                y: { type: "number", description: "Y position" },
                width: { type: "number", description: "Node width (default: 120)" },
                height: { type: "number", description: "Node height (default: 50)" },
                nodeType: { type: "string", description: "Node type (e.g. START, INTERVAL, LOG_MESSAGE)" },
                connectors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Connector ID (format: {nodeId}-{type}{index})" },
                      name: { type: "string", description: "Connector name" },
                      type: { type: "string", enum: ["in", "out"], description: "Connector direction" },
                    },
                    required: ["id", "name", "type"],
                  },
                },
                data: {
                  type: "object",
                  description: "Node-specific configuration data",
                },
              },
              required: ["id", "title", "x", "y", "width", "height", "nodeType", "connectors"],
            },
          },
          edges: {
            type: "array",
            description: "Array of flow edges",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Edge ID (format: {source}-{target})" },
                source: { type: "string", description: "Source connector ID (must be 'out' type)" },
                target: { type: "string", description: "Target connector ID (must be 'in' type)" },
              },
              required: ["id", "source", "target"],
            },
          },
        },
        required: ["nodes", "edges"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_nodes",
      description: "Add new nodes to the existing flow without removing existing ones.",
      parameters: {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            description: "Array of nodes to add",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
                nodeType: { type: "string" },
                connectors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      type: { type: "string", enum: ["in", "out"] },
                    },
                    required: ["id", "name", "type"],
                  },
                },
                data: { type: "object" },
              },
              required: ["id", "title", "x", "y", "width", "height", "nodeType", "connectors"],
            },
          },
        },
        required: ["nodes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_edges",
      description: "Add new edges (connections) to the existing flow.",
      parameters: {
        type: "object",
        properties: {
          edges: {
            type: "array",
            description: "Array of edges to add",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                source: { type: "string", description: "Source connector ID (out type)" },
                target: { type: "string", description: "Target connector ID (in type)" },
              },
              required: ["id", "source", "target"],
            },
          },
        },
        required: ["edges"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_nodes",
      description: "Remove nodes from the flow. Connected edges are automatically removed.",
      parameters: {
        type: "object",
        properties: {
          node_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of node IDs to remove",
          },
        },
        required: ["node_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_node",
      description: "Update the data (configuration) of an existing node.",
      parameters: {
        type: "object",
        properties: {
          node_id: { type: "string", description: "ID of the node to update" },
          data: {
            type: "object",
            description: "New data fields to merge into the node's data",
          },
        },
        required: ["node_id", "data"],
      },
    },
  },
];
