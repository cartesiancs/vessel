import { Node } from "./flowTypes";

type DefaultValueType = {
  connectors: Node["connectors"];
  nodeType: Node["nodeType"];
  data: Node["data"];
  compute: Node["compute"];
};

export const DEFINITION_NODE: {
  [title: string]: DefaultValueType;
} = {
  TITLE: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "TITLE",
    data: undefined,
    compute: () => ({ out: { number: 1 } }),
  },
  BUTTON: {
    connectors: [{ id: `id`, name: "out", type: "out" }],
    nodeType: "BUTTON",
    data: undefined,
    compute: () => ({ out: { number: 1 } }),
  },
  NUMBER: {
    connectors: [{ id: `id`, name: "number", type: "out" }],
    nodeType: "NUMBER",
    data: {
      number: 0,
    },
    compute: (_, data) => {
      if (data && "value" in data && typeof data.value === "number") {
        return { number: { number: data.value } };
      }
      return { number: { number: 0 } };
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
    compute: (inputs) => {
      const inputA = inputs.a;
      const inputB = inputs.b;

      if (
        inputA &&
        "value" in inputA &&
        typeof inputA.value === "number" &&
        inputB &&
        "value" in inputB &&
        typeof inputB.value === "number"
      ) {
        const result = inputA.value + inputB.value;
        return { number: { number: result } };
      }

      return { number: { number: 0 } };
    },
  },
};
