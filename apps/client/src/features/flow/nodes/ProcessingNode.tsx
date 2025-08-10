import { Node } from "../flowTypes";

export function renderProcessingNode(
  g: d3.Selection<SVGGElement, Node, null, undefined>,
  d: Node,
) {
  const w = d.width;
  const h = d.height;
  g.append("text")
    .attr("x", w / 2)
    .attr("y", h / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 8)
    .attr("fill", "#fff")
    .text(d.nodeType || "PROCESSING");
}
