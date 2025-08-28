import { Node } from "./flowTypes";

type DefaultValueType = {
  connectors: Node["connectors"];
  nodeType: Node["nodeType"];
  data: Node["data"];
  dataType: Node["dataType"];
};

export const DEFINITION_NODE: {
  [title: string]: DefaultValueType;
} = {
  START: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "START",
    data: undefined,
    dataType: undefined,
  },
  TITLE: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "TITLE",
    data: undefined,
    dataType: undefined,
  },
  BUTTON: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "BUTTON",
    data: undefined,
    dataType: undefined,
  },
  NUMBER: {
    connectors: [{ id: `id`, name: "number", type: "out" }],
    nodeType: "NUMBER",
    data: {
      number: 0,
    },
    dataType: {
      number: "NUMBER",
    },
  },
  ADD: {
    connectors: [
      { id: `id`, name: "a", type: "in" },
      { id: `id`, name: "b", type: "in" },
      { id: `id`, name: "number", type: "out" },
    ],
    nodeType: "ADD",
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
      variableType: "SELECT[string,number,boolean]",
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
};
