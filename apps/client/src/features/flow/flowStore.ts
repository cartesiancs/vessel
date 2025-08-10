import { create } from "zustand";
import { Edge, Node } from "./flowTypes";

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

export const useFlowStore = create<FlowState>((set) => ({
  nodes: [],
  edges: [],

  setNodes: (nodes) => set(() => ({ nodes })),
  setEdges: (edges) => set(() => ({ edges })),
}));
