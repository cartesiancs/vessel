import { CustomNode, CustomNodeDynamicData } from "@/entities/custom-nodes";
import { DEFINITION_NODE } from "./flowNode";
import { NodeTypes, Node, DataNodeTypeType } from "../model/types";

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

    let valueData = value[0].data;
    if (typeof valueData === "string") {
      try {
        valueData = JSON.parse(valueData);
      } catch {
        return null;
      }
    }

    if (!valueData) {
      return null;
    }

    // 중첩 구조 처리: {"data":{"connectors":[...],...},...} → 내부 data 사용
    const nested = valueData.data as Record<string, unknown> | undefined;
    if (!valueData.connectors && nested && nested.connectors) {
      valueData = nested as CustomNodeDynamicData;
    }

    valueData.nodeType = value[0].node_type;

    if (!valueData.connectors) {
      valueData.connectors = [];
    }

    const connectors = valueData.connectors as Array<Record<string, unknown>>;
    for (let index = 0; index < connectors.length; index++) {
      connectors[index].id = `${id}-${connectors[index].type}${index}`;
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

export function getNodeValue(
  nodes: DataNodeTypeType,
  type: NodeTypes,
  id: string,
) {
  const value = JSON.parse(JSON.stringify(nodes[type]));

  for (let index = 0; index < value.connectors.length; index++) {
    value.connectors[
      index
    ].id = `${id}-${value.connectors[index].type}${index}`;
  }

  return value;
}

export function getNode(
  nodes: DataNodeTypeType,
  type: NodeTypes,
  id: string,
  x: number = 100,
  y: number = 100,
): Node {
  const defaultValue = getNodeValue(nodes, type, id);

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
