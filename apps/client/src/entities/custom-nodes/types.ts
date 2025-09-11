export interface CustomNodeFromApi {
  node_type: string;
  data: string;
}

export interface CustomNodeData {
  name: string;
  description: string;
  category: string;
  script_path: string;
  connectors: Connector[];
  dataType?: Record<string, string>;
}

export interface CustomNode extends Omit<CustomNodeFromApi, "data"> {
  data: string;
}

export interface Connector {
  type: "in" | "out";
  name: string;
  label: string;
}

export interface CustomNodeState {
  nodes: CustomNode[];
  isLoading: boolean;
  error: string | null;
  fetchAllNodes: () => Promise<void>;
  createNode: (node: { node_type: string; data: string }) => Promise<void>;
  updateNode: (node_type: string, data: string) => Promise<void>;
  deleteNode: (node_type: string) => Promise<void>;
}
