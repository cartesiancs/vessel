import { LoopNodeType, Node } from "../flowTypes";

export function renderLoopNode(
  g: d3.Selection<SVGGElement, Node, null, undefined>,
  d: Node,
  onOpen: () => void,
) {
  const w = d.width;
  const h = d.height;
  const group = g
    .append("g")
    .attr("class", "node-content")
    .style("cursor", "pointer");
  group
    .append("rect")
    .attr("x", w / 2 - 40)
    .attr("y", h / 2 - 10)
    .attr("width", 80)
    .attr("height", 20)
    .attr("rx", 4)
    .attr("fill", "#2a2c36");
  group
    .append("text")
    .attr("x", w / 2)
    .attr("y", h / 2 + 1)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 8)
    .attr("fill", "#fff")
    .text(`Edit Loop ${(d.data as LoopNodeType).iterations ?? ""}`);
  group.on("click", (e) => {
    e.stopPropagation();
    onOpen();
  });
}
