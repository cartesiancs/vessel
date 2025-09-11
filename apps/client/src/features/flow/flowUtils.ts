import { CUSTOM_NODE, DEFINITION_NODE } from "./flowNode";
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

export function getCustomValue(type: string, id: string) {
  const value = CUSTOM_NODE.filter((item) => {
    return item.nodeType == type;
  });

  if (value) {
    for (let index = 0; index < value[0].connectors.length; index++) {
      value[0].connectors[
        index
      ].id = `${id}-${value[0].connectors[index].type}${index}`;
    }

    return value[0];
  }

  return null;
}

export function getCustomNode(
  type: NodeTypes,
  id: string,
  x: number = 100,
  y: number = 100,
): Node | null {
  const defaultValue = getCustomValue(type, id);

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
