export type Connector = {
  id: string;
  name: string;
  type: "in" | "out";
};

export type NodeRenderer = (
  g: d3.Selection<SVGGElement, Node, null, undefined>,
  d: Node,
) => void;

export type NodeTypes = "BUTTON" | "TITLE" | "NUMBER" | "ADD";

export type NumberNodeType = {
  number: number;
};

export type TextNodeType = {
  string: string;
};

export type AddNodeType = {
  a: number;
  b: number;
};

export type DataNodeType = NumberNodeType | TextNodeType | AddNodeType;

export type Node = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  connectors: Connector[];
  nodeType?: NodeTypes;
  data?: DataNodeType;
  compute?: (
    inputs: Record<string, DataNodeType>,
    data?: DataNodeType,
  ) => Record<string, DataNodeType>;
};

export type Edge = {
  id: string;
  source: string;
  target: string;
};

export interface GraphProps {
  nodes: Node[];
  edges: Edge[];
  width?: string | number;
  height?: string | number;
  gridSize?: number;
  gridColor?: string;
  edgeColor?: string;
  edgeWidth?: number;
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}
