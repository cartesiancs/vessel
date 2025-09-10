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
