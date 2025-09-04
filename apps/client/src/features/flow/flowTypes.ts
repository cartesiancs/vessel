export type Connector = {
  id: string;
  name: string;
  type: "in" | "out" | "execution";
};

export type NodeRenderer = (
  g: d3.Selection<SVGGElement, Node, null, undefined>,
  d: Node,
) => void;

export type NodeTypes =
  | "BUTTON"
  | "TITLE"
  | "START"
  | "SET_VARIABLE"
  | "CONDITION"
  | "LOG_MESSAGE"
  | "CALCULATION"
  | "LOOP"
  | "LOGIC_OPERATOR"
  | "HTTP_REQUEST"
  | "INTERVAL"
  | "TYPE_CONVERTER"
  | "MQTT_SUBSCRIBE"
  | "MQTT_PUBLISH"
  | "RTP_STREAM_IN"
  | "BRANCH"
  | "JSON_SELECTOR"
  | "DECODE_OPUS";

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

export type DataNodeType =
  | NumberNodeType
  | TextNodeType
  | AddNodeType
  | SetVariableNodeType
  | ConditionNodeType
  | HTTPRequestNodeType
  | LoopNodeType
  | LogicOpetatorNodeType
  | IntervalNodeType
  | MqttPublishNodeType
  | MqttSubscribeNodeType
  | TypeConverterNodeType
  | RtpStreamInNodeType
  | JsonSelectorNodeType
  | CalculationNodeType;

export type DataNodeTypeType = Record<string, string>;

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
