import { Node } from "../flowTypes";

export function renderButtonNode(
  g: d3.Selection<SVGGElement, Node, null, undefined>,
  d: Node,
  onOpen: () => void,
) {
  const w = d.width;
  const h = d.height;
  const group = g.append("g").style("cursor", "pointer");
  group
    .append("rect")
    .attr("x", w / 2 - 20)
    .attr("y", h / 2 - 10)
    .attr("width", 40)
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
    .text("Click");
  group.on("click", (e) => {
    e.stopPropagation();
    onOpen();
  });
}
