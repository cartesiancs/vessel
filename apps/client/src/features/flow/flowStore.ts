import { create } from "zustand";
import { Edge, Node } from "./flowTypes";
import {
  getFlows,
  getFlowVersions,
  saveFlowVersion,
  createFlow,
} from "@/entities/flow/api";
import { Flow } from "@/entities/flow/types";

interface FlowState {
  flows: Flow[];
  currentFlowId: number | null;
  isLoading: boolean;
  error: string | null;
  nodes: Node[];
  edges: Edge[];
  fetchFlows: () => Promise<void>;
  setCurrentFlowId: (flowId: number | null) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  createNewFlow: (name: string) => Promise<void>;
  saveGraph: (comment?: string) => Promise<void>;
  loadGraph: () => Promise<void>;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  flows: [],
  currentFlowId: null,
  nodes: [],
  edges: [],
  isLoading: false,
  error: null,

  fetchFlows: async () => {
    set({ isLoading: true, error: null });
    try {
      const flows = await getFlows();
      set({ flows, isLoading: false });
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Failed to fetch flows";
      set({ isLoading: false, error });
    }
  },

  setCurrentFlowId: (flowId: number | null) => {
    set({ currentFlowId: flowId, nodes: [], edges: [] });
    if (flowId) {
      get().loadGraph();
    }
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  createNewFlow: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const newFlow = await createFlow({ name, enabled: 1 });
      set((state) => ({
        flows: [...state.flows, newFlow],
        currentFlowId: newFlow.id,
        nodes: [],
        edges: [],
        isLoading: false,
      }));
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Failed to create flow";
      set({ isLoading: false, error });
    }
  },

  saveGraph: async (comment?: string) => {
    const { nodes, edges, currentFlowId } = get();
    if (!currentFlowId) {
      set({ error: "No flow selected" });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const graphData = { nodes, edges };
      const graph_json = JSON.stringify(graphData, null, 2);
      await saveFlowVersion(currentFlowId, { graph_json, comment });
      set({ isLoading: false });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to save graph";
      set({ isLoading: false, error });
      console.error(error);
    }
  },

  loadGraph: async () => {
    const { currentFlowId } = get();
    if (!currentFlowId) return;
    set({ isLoading: true, error: null });
    try {
      const versions = await getFlowVersions(currentFlowId);
      if (versions.length > 0) {
        const latestVersion = versions.sort((a, b) => b.version - a.version)[0];
        const graphData = JSON.parse(latestVersion.graph_json);
        if (graphData.nodes && graphData.edges) {
          set({
            nodes: graphData.nodes,
            edges: graphData.edges,
            isLoading: false,
          });
        }
      } else {
        set({ isLoading: false, nodes: [], edges: [] });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to load graph";
      set({ isLoading: false, error });
      console.error(error);
    }
  },
}));
