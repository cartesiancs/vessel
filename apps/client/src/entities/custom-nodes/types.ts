export interface CustomNodeFromApi {
  node_type: string;
  data: CustomNodeDynamicData;
}

export interface CustomNodeDynamicData {
  [key: string]: unknown;
}

export interface CustomNodeData {
  name: string;
  description: string;
  category: string;
  script_path: string;
  connectors: Connector[];
  dataType?: Record<string, string>;
}

export type CustomNode = CustomNodeFromApi;

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
  createNode: (node: {
    node_type: string;
    data: CustomNodeDynamicData;
  }) => Promise<void>;
  updateNode: (node_type: string, data: CustomNodeDynamicData) => Promise<void>;
  deleteNode: (node_type: string) => Promise<void>;
}
