import { create } from "zustand";
import { CustomNodeState } from "./types";
import * as api from "./api";

// const parseNodeData = (nodeFromApi: CustomNodeFromApi): CustomNodeFromApi => {
//   try {
//     return {
//       ...nodeFromApi,
//       data: nodeFromApi.data,
//     };
//   } catch (error) {
//     console.error(
//       `Failed to parse data for node ${nodeFromApi.node_type}`,
//       error,
//     );
//     // Return a default/error state if parsing fails
//     return {
//       node_type: nodeFromApi.node_type,
//       data: {},
//     };
//   }
// };

export const useCustomNodeStore = create<CustomNodeState>((set) => ({
  nodes: [],
  isLoading: false,
  error: null,
  fetchAllNodes: async () => {
    set({ isLoading: true, error: null });
    try {
      const nodesFromApi = await api.getAllCustomNodes();
      set({ nodes: nodesFromApi, isLoading: false });
    } catch {
      set({ error: "Failed to fetch nodes.", isLoading: false });
    }
  },
  createNode: async (node) => {
    set({ isLoading: true, error: null });
    try {
      const newNodeFromApi = await api.createCustomNode(node);
      set((state) => ({
        nodes: [...state.nodes, newNodeFromApi],
        isLoading: false,
      }));
    } catch {
      set({ error: "Failed to create node.", isLoading: false });
    }
  },
  updateNode: async (node_type, data) => {
    set({ isLoading: true, error: null });
    try {
      const updatedNodeFromApi = await api.updateCustomNode(node_type, data);
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.node_type === node_type ? updatedNodeFromApi : n,
        ),
        isLoading: false,
      }));
    } catch {
      set({ error: "Failed to update node.", isLoading: false });
    }
  },
  deleteNode: async (node_type) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteCustomNode(node_type);
      set((state) => ({
        nodes: state.nodes.filter((n) => n.node_type !== node_type),
        isLoading: false,
      }));
    } catch {
      set({ error: "Failed to delete node.", isLoading: false });
    }
  },
}));
