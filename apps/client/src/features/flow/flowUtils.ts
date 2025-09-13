import { CustomNode } from "@/entities/custom-nodes/types";
import { DEFINITION_NODE } from "./flowNode";
import { NodeTypes, Node } from "./flowTypes";

export function getDefalutValue(type: NodeTypes, id: string) {
  const value = JSON.parse(JSON.stringify(DEFINITION_NODE[type]));

  for (let index = 0; index < value.connectors.length; index++) {
    value.connectors[
      index
    ].id = `${id}-${value.connectors[index].type}${index}`;
  }

  return value;
}

export function getDefalutNode(
  type: NodeTypes,
  id: string,
  x: number = 100,
  y: number = 100,
): Node {
  const defaultValue = getDefalutValue(type, id);

  return {
    id: id,
    title: id,
    x: x,
    y: y,
    width: 120,
    height: 50,
    ...defaultValue,
  };
}

export function getCustomValue(
  customNodes: CustomNode[],
  type: string,
  id: string,
) {
  const value = customNodes.filter((item) => {
    return item.node_type == type;
  });

  if (value) {
    if (value.length <= 0) {
      return null;
    }

    // NOTE: FIX THIS CODE( multiple parse )
    const valueData = JSON.parse(JSON.parse(value[0].data));
    for (let index = 0; index < valueData.connectors.length; index++) {
      valueData.connectors[
        index
      ].id = `${id}-${valueData.connectors[index].type}${index}`;
    }

    return valueData;
  }

  return null;
}

export function getCustomNode(
  customNodes: CustomNode[],
  type: NodeTypes,
  id: string,
  x: number = 100,
  y: number = 100,
) {
  const defaultValue = getCustomValue(customNodes, type, id);

  if (!defaultValue) {
    return null;
  }

  return {
    id: id,
    title: id,
    x: x,
    y: y,
    width: 120,
    height: 50,
    ...defaultValue,
  };
}
