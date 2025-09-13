import { Node } from "./flowTypes";

type DefaultValueType = {
  connectors: Node["connectors"];
  nodeType: string;
  data: Node["data"];
  dataType: Node["dataType"];
};

export const DEFINITION_NODE = {
  START: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "START",
    data: undefined,
    dataType: undefined,
  },
  SET_VARIABLE: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "SET_VARIABLE",
    data: {
      variable: "",
      variableType: "string",
    },
    dataType: {
      variable: "ANY",
      variableType: "SELECT[string,number,boolean,json]",
    },
  },
  CONDITION: {
    connectors: [
      { id: `id`, name: "input", type: "in" },
      { id: `id`, name: "true", type: "out" },
      { id: `id`, name: "false", type: "out" },
    ],
    nodeType: "CONDITION",
    data: {
      operator: "GreaterThan",
      operand: 0,
    },
    dataType: {
      operator: "SELECT[GreaterThan,LessThan,EqualTo]",
      operand: "NUMBER",
    },
  },
  LOG_MESSAGE: {
    connectors: [{ id: `id`, name: "message", type: "in" }],
    nodeType: "LOG_MESSAGE",
    data: undefined,
    dataType: undefined,
  },
  CALCULATION: {
    connectors: [
      { id: `id`, name: "a", type: "in" },
      { id: `id`, name: "b", type: "in" },
      { id: `id`, name: "number", type: "out" },
    ],
    nodeType: "CALCULATION",
    data: {
      operatorCalc: "+",
    },
    dataType: {
      operatorCalc: "SELECT[+,-,/,*,%]",
    },
  },
  HTTP_REQUEST: {
    connectors: [
      { id: `id`, name: "execution", type: "in" },
      { id: `id`, name: "result", type: "out" },
    ],
    nodeType: "HTTP_REQUEST",
    data: {
      url: "",
      httpMethod: "GET",
    },
    dataType: {
      url: "STRING",
      httpMethod: "SELECT[GET,POST,DELETE,PUT]",
    },
  },
  LOOP: {
    connectors: [
      { id: `id`, name: "start", type: "in" },
      { id: `id`, name: "body", type: "out" },
    ],
    nodeType: "LOOP",
    data: {
      iterations: 5,
    },
    dataType: {
      iterations: "NUMBER",
    },
  },
  LOGIC_OPERATOR: {
    connectors: [
      { id: `id`, name: "a", type: "in" },
      { id: `id`, name: "b", type: "in" },
      { id: `id`, name: "bool", type: "out" },
    ],
    nodeType: "LOGIC_OPERATOR",
    data: {
      operator: "AND",
    },
    dataType: {
      operator: "SELECT[AND,OR,XOR,NAND,NOR,XNOR,>,<,==,!=,>=,<=]",
    },
  },
  INTERVAL: {
    connectors: [{ id: `id`, name: "exec", type: "out" }],
    nodeType: "INTERVAL",
    data: {
      interval: 10,
      unit: "seconds",
    },
    dataType: {
      interval: "NUMBER",
      unit: "SELECT[milliseconds,seconds,minutes]",
    },
  },
  MQTT_PUBLISH: {
    connectors: [{ id: `id`, name: "payload", type: "in" }],
    nodeType: "MQTT_PUBLISH",
    data: {
      topic: "default/topic",
      qos: 1,
      retain: false,
    },
    dataType: {
      topic: "STRING",
      qos: "SELECT[0,1,2]",
      retain: "BOOLEAN",
    },
  },
  MQTT_SUBSCRIBE: {
    connectors: [{ id: `id`, name: "payload", type: "out" }],
    nodeType: "MQTT_SUBSCRIBE",
    data: {
      topic: "default/topic",
    },
    dataType: {
      topic: "STRING",
    },
  },
  TYPE_CONVERTER: {
    connectors: [
      { id: `id`, name: "in", type: "in" },
      { id: `id`, name: "out", type: "out" },
    ],
    nodeType: "TYPE_CONVERTER",
    data: {
      targetType: "string",
    },
    dataType: {
      targetType: "SELECT[string,number,boolean]",
    },
  },
  RTP_STREAM_IN: {
    connectors: [
      { id: `id`, name: "payload", type: "out" },
      { id: `id`, name: "raw_packet", type: "out" },
    ],
    nodeType: "RTP_STREAM_IN",
    data: {
      topic: "default/audio",
    },
    dataType: {
      topic: "STRING",
    },
  },
  DECODE_OPUS: {
    connectors: [
      { id: `id`, name: "payload", type: "in" },
      { id: `id`, name: "info", type: "out" },
    ],
    nodeType: "DECODE_OPUS",
    data: undefined,
    dataType: undefined,
  },
  BRANCH: {
    connectors: [
      { id: `id`, name: "data", type: "in" },
      { id: `id`, name: "condition", type: "in" },
      { id: `id`, name: "true_output", type: "out" },
      { id: `id`, name: "false_output", type: "out" },
    ],
    nodeType: "BRANCH",
    data: undefined,
    dataType: undefined,
  },
  JSON_SELECTOR: {
    connectors: [
      { id: `id`, name: "json", type: "in" },
      { id: `id`, name: "value", type: "out" },
    ],
    nodeType: "JSON_SELECTOR",
    data: {
      path: "path.to.value",
    },
    dataType: {
      path: "STRING",
    },
  },
  DECODE_H264: {
    connectors: [
      { id: `id`, name: "payload", type: "in" },
      { id: `id`, name: "frame", type: "out" },
    ],
    nodeType: "DECODE_H264",
    data: undefined,
    dataType: undefined,
  },
  YOLO_DETECT: {
    connectors: [
      { id: `id`, name: "frame", type: "in" },
      { id: `id`, name: "detections", type: "out" },
    ],
    nodeType: "YOLO_DETECT",
    data: {
      model_path: "assets/yolov8n.onnx",
      labels_path: "assets/coco.names",
      confidence_threshold: 0.5,
      nms_threshold: 0.4,
      input_size: 640,
    },
    dataType: {
      model_path: "STRING",
      labels_path: "STRING",
      confidence_threshold: "NUMBER",
      nms_threshold: "NUMBER",
      input_size: "NUMBER",
    },
  },
  GST_DECODER: {
    connectors: [{ id: "id", name: "frame", type: "out" }],
    nodeType: "GST_DECODER",
    data: {
      topic: "go_video_stream_1",
    },
    dataType: {
      topic: "STRING",
    },
  },
  WEBSOCKET_ON: {
    connectors: [{ id: "id", name: "payload", type: "out" }],
    nodeType: "WEBSOCKET_ON",
    data: {
      url: "ws://localhost:8080",
    },
    dataType: {
      url: "STRING",
    },
  },
  WEBSOCKET_SEND: {
    connectors: [{ id: "id", name: "payload", type: "in" }],
    nodeType: "WEBSOCKET_SEND",
    data: {
      url: "ws://localhost:8080",
    },
    dataType: {
      url: "STRING",
    },
  },
} as const;

export const CUSTOM_NODE: DefaultValueType[] = [
  {
    connectors: [
      { id: "id", name: "number", type: "in" },
      { id: "id", name: "number", type: "out" },
    ],
    nodeType: "_PYTHON_CUSTOM_NODE",

    data: {
      path: "{:code}/add_node.py",
    },
    dataType: {
      path: "FIXED_STRING",
    },
  },
];
