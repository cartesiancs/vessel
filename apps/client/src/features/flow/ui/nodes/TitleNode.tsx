import { Node } from "../flowTypes";

export function renderTitleNode(
  g: d3.Selection<SVGGElement, Node, null, undefined>,
  d: Node,
) {
  const w = d.width;
  const h = d.height;
  g.append("text")
    .attr("class", "node-content")
    .attr("x", w / 2)
    .attr("y", h / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 8)
    .attr("fill", "#fff")
    .text(d.title);
}
