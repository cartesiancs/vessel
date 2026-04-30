import { DEFINITION_NODE } from "./flowNode";

export type Connector = {
  id: string;
  name: string;
  type: "in" | "out" | "execution";
};

export type NodeRenderer = (
  g: d3.Selection<SVGGElement, Node, null, undefined>,
  d: Node,
) => void;

export type NodeTypes = keyof typeof DEFINITION_NODE;

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

export type SetVariableNodeType = {
  variable: string | number | boolean;
  variableType?: "string" | "number" | "boolean";
};

export type ConditionNodeType = {
  operator: "GreaterThan" | "LessThan" | "EqualTo";
  operand: number;
};

export type CalculationNodeType = {
  operatorCalc: "+" | "-" | "/" | "*" | "%";
};

export type LogicOpetatorNodeType = {
  operator:
    | "AND"
    | "OR"
    | "XOR"
    | "NAND"
    | "XNOR"
    | "NOR"
    | "<"
    | ">"
    | "="
    | "!="
    | ">="
    | "<=";
};

export type HTTPRequestNodeType = {
  url: string;
  httpMethod: "POST" | "GET" | "DELETE" | "PUT";
};

export type LoopNodeType = {
  iterations: number;
};

export type IntervalNodeType = {
  interval: number;
  unit: "milliseconds" | "seconds" | "minutes";
};

export type MqttPublishNodeType = {
  topic: string;
  qos: 0 | 1 | 2;
  retain: boolean;
};

export type MqttSubscribeNodeType = {
  topic: string;
};

export type TypeConverterNodeType = {
  targetType: "string" | "number" | "boolean";
};

export type RtpStreamInNodeType = {
  topic: string;
};

export type JsonSelectorNodeType = {
  path: string;
};

export type GstDecoderNodeType = {
  topic: string;
};

export type YoloDetectNodeType = {
  model_path: string;
  labels_path: string;
  confidence_threshold: number;
  nms_threshold: number;
  input_size: number;
};

export type WebSocketOnNodeType = {
  url: string;
};

export type WebSocketSendNodeType = {
  url: string;
};

type Generalize<T> = {
  -readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends number
    ? number
    : T[K] extends boolean
    ? boolean
    : T[K];
};

type AllSpecificDataNodeTypes = {
  [K in keyof typeof DEFINITION_NODE]: (typeof DEFINITION_NODE)[K]["data"];
};
type SpecificDataNodeType =
  AllSpecificDataNodeTypes[keyof AllSpecificDataNodeTypes];

export type DataNodeType = Generalize<Exclude<SpecificDataNodeType, undefined>>;

export type DataNodeTypeType = Record<string, string>;

export type Node = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  connectors: Connector[];
  nodeType?: string;
  data?: DataNodeType;
  dataType?: DataNodeTypeType;
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
