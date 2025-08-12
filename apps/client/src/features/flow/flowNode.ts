import { Node } from "./flowTypes";

type DefaultValueType = {
  connectors: Node["connectors"];
  nodeType: Node["nodeType"];
  data: Node["data"];
};

export const DEFINITION_NODE: {
  [title: string]: DefaultValueType;
} = {
  START: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "START",
    data: undefined,
  },
  TITLE: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "TITLE",
    data: undefined,
  },
  BUTTON: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "BUTTON",
    data: undefined,
  },
  NUMBER: {
    connectors: [{ id: `id`, name: "number", type: "out" }],
    nodeType: "NUMBER",
    data: {
      number: 0,
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
  },
  SET_VARIABLE: {
    connectors: [
      { id: `id`, name: "in", type: "in" },
      { id: `id`, name: "out", type: "out" },
    ],
    nodeType: "SET_VARIABLE",
    data: {
      variableName: "myVar",
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
  },
  LOG_MESSAGE: {
    connectors: [{ id: `id`, name: "message", type: "in" }],
    nodeType: "LOG_MESSAGE",
    data: undefined,
  },
};
