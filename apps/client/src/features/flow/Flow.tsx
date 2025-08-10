import { Graph } from "./Graph";
import { useFlowStore } from "./flowStore";

export default function Flow() {
  const { nodes, edges, setNodes, setEdges } = useFlowStore();

  return (
    <Graph
      nodes={nodes}
      edges={edges}
      onNodesChange={setNodes}
      onEdgesChange={setEdges}
    />
  );
}
