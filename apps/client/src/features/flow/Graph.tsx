import { useState, useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { Plus, Minus, Lock, LockOpen, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GraphProps,
  Node,
  Edge,
  Connector,
  NodeRenderer,
  NodeTypes,
} from "./flowTypes";

// import { renderButtonNode } from "./nodes/ButtonNode";
import { renderTitleNode } from "./nodes/TitleNode";
import { Options } from "./Options";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renderProcessingNode } from "./nodes/ProcessingNode";
import { getDefalutNode } from "./flowUtils";
import { renderVarNode } from "./nodes/VarNode";
import { renderCalcNode } from "./nodes/CalcNode";
import { renderHttpNode } from "./nodes/HttpNode";
import { formatConstantCase } from "@/lib/string";
import { renderLogicNode } from "./nodes/LogicNode";
import { renderIntervalNode } from "./nodes/IntervalNode";
import { renderMQTTNode } from "./nodes/MQTTNode";
import { renderButtonNode } from "./nodes/ButtonNode";
import { zoomIdentity } from "d3-zoom";

type NodeGroup = {
  label: string;
  nodes: string[];
};

const nodeColor = "#2a2c36";
const nodeHoverColor = "#444754";

const nodeLightColor = "#d1d4e3";
const highlightColor = "#1976d2";

const nodeGroups: NodeGroup[] = [
  {
    label: "Default",
    nodes: ["START", "LOG_MESSAGE"],
  },
  {
    label: "Data",
    nodes: [
      "SET_VARIABLE",
      "TYPE_CONVERTER",
      "RTP_STREAM_IN",
      "DECODE_OPUS",
      "GST_DECODER",
    ],
  },
  {
    label: "Logic",
    nodes: [
      "CALCULATION",
      "LOGIC_OPERATOR",
      "INTERVAL",
      "BRANCH",
      "JSON_SELECTOR",
    ],
  },
  {
    label: "Communication",
    nodes: [
      "HTTP_REQUEST",
      "MQTT_PUBLISH",
      "MQTT_SUBSCRIBE",
      "WEBSOCKET_SEND",
      "WEBSOCKET_ON",
    ],
  },
  {
    label: "AI/ML",
    nodes: ["YOLO_DETECT"],
  },
];

export function Graph({
  nodes,
  edges,
  width = "100%",
  height = "100%",
  gridSize = 20,
  gridColor = "#2f2f38",
  edgeColor = "#666",
  edgeWidth = 2,
  onNodesChange,
  onEdgesChange,
}: GraphProps) {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(
    null,
  );
  const [locked, setLocked] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{
    type: "node" | "edge";
    id: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [openedNode, setOpenedNode] = useState<Node | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef(zoomIdentity);

  const edgesRef = useRef(edges);
  const nodesRef = useRef(nodes);

  const nodeRenderers: Record<string, NodeRenderer> = {
    START: (g, d) => renderTitleNode(g, d),
    SET_VARIABLE: (g, d) => renderVarNode(g, d, () => handleClickOption(d)),
    CONDITION: (g, d) => renderProcessingNode(g, d),
    LOG_MESSAGE: (g, d) => renderProcessingNode(g, d),
    CALCULATION: (g, d) => renderCalcNode(g, d, () => handleClickOption(d)),
    HTTP_REQUEST: (g, d) => renderHttpNode(g, d, () => handleClickOption(d)),
    INTERVAL: (g, d) => renderIntervalNode(g, d, () => handleClickOption(d)),
    LOGIC_OPERATOR: (g, d) => renderLogicNode(g, d, () => handleClickOption(d)),
    MQTT_PUBLISH: (g, d) => renderMQTTNode(g, d, () => handleClickOption(d)),
    MQTT_SUBSCRIBE: (g, d) => renderMQTTNode(g, d, () => handleClickOption(d)),
    TYPE_CONVERTER: (g, d) =>
      renderButtonNode(g, d, () => handleClickOption(d)),
    RTP_STREAM_IN: (g, d) => renderButtonNode(g, d, () => handleClickOption(d)),
    DECODE_OPUS: (g, d) => renderProcessingNode(g, d),
    DECODE_H264: (g, d) => renderProcessingNode(g, d),

    BRANCH: (g, d) => renderProcessingNode(g, d),
    JSON_SELECTOR: (g, d) => renderButtonNode(g, d, () => handleClickOption(d)),
    YOLO_DETECT: (g, d) => renderButtonNode(g, d, () => handleClickOption(d)),
    GST_DECODER: (g, d) => renderButtonNode(g, d, () => handleClickOption(d)),

    WEBSOCKET_SEND: (g, d) =>
      renderButtonNode(g, d, () => handleClickOption(d)),
    WEBSOCKET_ON: (g, d) => renderButtonNode(g, d, () => handleClickOption(d)),
  };

  const handleClickOption = (node: Node) => {
    setOpenedNode(node);
    setOpen(true);
  };

  const handleOpenOptions = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  useEffect(() => {
    edgesRef.current = edges;
    nodesRef.current = nodes;
  }, [edges, nodes]);

  const dragLineRef = useRef<d3.Selection<
    SVGLineElement,
    unknown,
    null,
    undefined
  > | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);

  const handleAddNode = useCallback(
    (type: NodeTypes) => {
      if (!onNodesChange || !svgRef.current) return;

      const currentTransform = transformRef.current;

      const svgRect = svgRef.current.getBoundingClientRect();
      const viewCenterX = svgRect.width / 2;
      const viewCenterY = svgRect.height / 2;

      const [worldX, worldY] = currentTransform.invert([
        viewCenterX,
        viewCenterY,
      ]);

      const id = `${type}-${Date.now()}`;
      const value = getDefalutNode(type, id, worldX, worldY);

      onNodesChange([
        ...nodesRef.current,
        {
          ...value,
        },
      ]);
    },
    [onNodesChange],
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    if (!svg.select("defs").size()) {
      svg
        .append("defs")
        .append("pattern")
        .attr("id", "grid")
        .attr("width", gridSize)
        .attr("height", gridSize)
        .attr("patternUnits", "userSpaceOnUse")
        .append("circle")
        .attr("cx", gridSize / 2)
        .attr("cy", gridSize / 2)
        .attr("r", 1)
        .attr("fill", gridColor);
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2])
      .on("zoom", (e) => {
        transformRef.current = e.transform;

        if (!locked)
          d3.select<SVGGElement, unknown>(gRef.current!).attr(
            "transform",
            e.transform,
          );
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    svg.on("click.clearSelection", () => {
      setSelectedElement(null);
    });

    return () => {
      svg.on("click.clearSelection", null);
    };
  }, [gridSize, gridColor, locked]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" || !selectedElement) return;

      if (selectedElement.type === "node") {
        const removedNode = nodesRef.current.find(
          (n) => n.id === selectedElement.id,
        );
        const removedConnIds = removedNode
          ? removedNode.connectors.map((c) => c.id)
          : [];

        onNodesChange?.(
          nodesRef.current.filter((n) => n.id !== selectedElement.id),
        );
        onEdgesChange?.(
          edgesRef.current.filter(
            (ed) =>
              !removedConnIds.includes(ed.source) &&
              !removedConnIds.includes(ed.target),
          ),
        );
      } else {
        onEdgesChange?.(
          edgesRef.current.filter((ed) => ed.id !== selectedElement.id),
        );
      }

      setSelectedElement(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedElement, onNodesChange, onEdgesChange]);

  useEffect(() => {
    const g = d3.select(gRef.current);

    g.selectAll<SVGRectElement, unknown>("rect.grid-bg")
      .data([null])
      .join("rect")
      .attr("class", "grid-bg")
      .attr("x", -5000)
      .attr("y", -5000)
      .attr("width", 10000)
      .attr("height", 10000)
      .attr("fill", "url(#grid)")
      .attr("pointer-events", "none");

    const nodeSel = g
      .selectAll<SVGGElement, Node>("g.node")
      .data(nodes, (d) => d.id);

    nodeSel.exit().remove();

    const nodeEnter = nodeSel
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("cursor", "pointer");

    nodeEnter
      .append("rect")
      .attr("class", "node-body")
      .attr("width", (d) => d.width)
      .attr("height", (d) => d.height)
      .attr("fill", "#07070f")
      .attr("stroke", nodeColor)
      .attr("stroke-width", 1);

    nodeEnter
      .append("rect")
      .attr("class", "node-header")
      .attr("width", (d) => d.width)
      .attr("height", 10)
      .attr("fill", nodeColor);

    nodeEnter
      .append("text")
      .attr("x", (d) => d.width / 2)
      .attr("y", 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "hanging")
      .attr("fill", nodeLightColor)
      .attr("font-size", 8)
      .attr("font-weight", 800)
      .text((d) => d.nodeType || "");

    const nodesMerged = nodeEnter.merge(nodeSel);

    nodesMerged
      .attr(
        "transform",
        (d) => `translate(${d.x - d.width / 2},${d.y - d.height / 2})`,
      )
      .select<SVGRectElement>("rect")
      .attr("stroke", (d) =>
        selectedElement?.type === "node" && selectedElement.id === d.id
          ? highlightColor
          : nodeColor,
      );

    nodesMerged
      .select<SVGRectElement>(".node-body")
      .attr("stroke", (d) =>
        selectedElement?.type === "node" && selectedElement.id === d.id
          ? highlightColor
          : nodeColor,
      );

    nodesMerged
      .on("mouseover", function (event, d) {
        if (selectedElement?.type === "node" && selectedElement.id === d.id)
          return;
        d3.select(this)
          .select(".node-body")
          .transition()
          .duration(100)
          .attr("stroke", nodeHoverColor);

        d3.select(this)
          .select(".node-header")
          .transition()
          .duration(100)
          .attr("fill", nodeHoverColor);
      })
      .on("mouseout", function (event, d) {
        if (selectedElement?.type === "node" && selectedElement.id === d.id)
          return;
        d3.select(this)
          .select(".node-body")
          .transition()
          .duration(100)
          .attr("stroke", nodeColor);

        d3.select(this)
          .select(".node-header")
          .transition()
          .duration(100)
          .attr("fill", nodeColor);
      });

    nodesMerged
      .select<SVGRectElement>(".node-header")
      .attr("fill", (d) =>
        selectedElement?.type === "node" && selectedElement.id === d.id
          ? highlightColor
          : nodeColor,
      );

    nodesMerged.each(function (d) {
      const g = d3.select<SVGGElement, Node>(this);
      //console.log("Rendering nodes:");
      g.selectAll(".node-content").remove();
      const renderer = d.nodeType ? nodeRenderers[d.nodeType] : null;
      if (renderer) renderer(g, d);
    });

    const drag = d3.drag<SVGGElement, Node>().on("drag", (e, d) => {
      if (locked || isDraggingRef.current) return;
      const updated = nodesRef.current.map((n) =>
        n.id === d.id ? { ...n, x: e.x, y: e.y } : n,
      );
      onNodesChange?.(updated);
    });

    nodesMerged.on("click", (e, d) => {
      e.stopPropagation();
      setSelectedElement({ type: "node", id: d.id });
    });

    nodesMerged.call(drag);

    const connSel = nodesMerged
      .selectAll<SVGGElement, Connector>("g.connector")
      .data(
        (d) => d.connectors,
        (c) => c.id,
      );

    connSel.exit().remove();

    const connEnter = connSel.enter().append("g").attr("class", "connector");

    connEnter.append("circle").attr("r", 3);

    connEnter
      .append("text")
      .attr("font-size", 8)
      .attr("dy", 4)
      .attr("text-anchor", (c) => (c.type === "in" ? "end" : "start"))
      .attr("dx", (c) => (c.type === "in" ? -6 : 6))
      .attr("fill", nodeLightColor)
      .text((c) => c.name);

    connEnter
      .merge(connSel)
      .attr("data-connector-id", (c) => c.id)
      .attr("data-connector-type", (c) => c.type)
      .attr("transform", (c, i, els) => {
        const parentEl = els[i].parentNode as SVGGElement;
        const parent = d3.select<SVGGElement, Node>(parentEl).datum();
        const list = parent.connectors.filter((x) => x.type === c.type);
        const idx = list.findIndex((x) => x.id === c.id);
        const h = parent.height;
        const spacing = list.length > 0 ? h / list.length : 0;
        const dx = c.type === "in" ? 0 : parent.width;
        const dy = spacing * idx + spacing / 2;
        return `translate(${dx},${dy})`;
      })
      .select("circle")
      .attr("fill", (c) =>
        selectedConnector === c.id ? highlightColor : nodeLightColor,
      );

    const edgeSel = g
      .selectAll<SVGPathElement, Edge>("path.edge")
      .data(edges, (d) => d.id);

    edgeSel.exit().remove();

    const edgeEnter = edgeSel
      .enter()
      .append("path")
      .attr("class", "edge")
      .attr("fill", "none")
      .style("cursor", "pointer")
      .attr("stroke", edgeColor)
      .attr("stroke-width", edgeWidth);

    edgeEnter
      .merge(edgeSel)
      .attr("stroke", (d) =>
        selectedElement?.type === "edge" && selectedElement.id === d.id
          ? highlightColor
          : edgeColor,
      )
      .attr("d", (d) => {
        const srcNode = nodes.find((n) =>
          n.connectors.some((c) => c.id === d.source),
        )!;
        const srcConn = srcNode.connectors.find((c) => c.id === d.source)!;
        const srcW = srcNode.width;
        const srcH = srcNode.height;
        const srcDx = srcConn.type === "in" ? 0 : srcW;
        const srcList = srcNode.connectors.filter(
          (c) => c.type === srcConn.type,
        );
        const srcIdx = srcList.findIndex((c) => c.id === srcConn.id);
        const srcSpacing = srcList.length > 0 ? srcH / srcList.length : 0;
        const srcDy = srcSpacing * srcIdx + srcSpacing / 2;
        const x1 = srcNode.x - srcW / 2 + srcDx;
        const y1 = srcNode.y - srcH / 2 + srcDy;

        const tgtNode = nodes.find((n) =>
          n.connectors.some((c) => c.id === d.target),
        )!;
        const tgtConn = tgtNode.connectors.find((c) => c.id === d.target)!;
        const tgtW = tgtNode.width;
        const tgtH = tgtNode.height;
        const tgtDx = tgtConn.type === "in" ? 0 : tgtW;
        const tgtList = tgtNode.connectors.filter(
          (c) => c.type === tgtConn.type,
        );
        const tgtIdx = tgtList.findIndex((c) => c.id === tgtConn.id);
        const tgtSpacing = tgtList.length > 0 ? tgtH / tgtList.length : 0;
        const tgtDy = tgtSpacing * tgtIdx + tgtSpacing / 2;
        const x2 = tgtNode.x - tgtW / 2 + tgtDx;
        const y2 = tgtNode.y - tgtH / 2 + tgtDy;

        const mx = (x1 + x2) / 2;
        return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      })
      .on("click", (e, d) => {
        e.stopPropagation();
        setSelectedElement({ type: "edge", id: d.id });
      });

    g.selectAll<SVGPathElement, Edge>(".edge-hit").remove();

    g.selectAll<SVGPathElement, Edge>("path.edge")
      .style("pointer-events", "none")
      .style("transition", "stroke 0.2s ease")
      .each(function (d) {
        const original = this as SVGPathElement;
        const hit = original.cloneNode(false) as SVGPathElement;
        hit.setAttribute("class", "edge-hit");
        hit.setAttribute("fill", "none");
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "12");
        hit.style.pointerEvents = "stroke";
        hit.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedElement({ type: "edge", id: d.id });
        });

        hit.addEventListener("mouseover", () => {
          hit.setAttribute("stroke", "#26282b90");
        });
        hit.addEventListener("mouseout", () => {
          hit.setAttribute("stroke", "transparent");
        });
        original.parentNode!.insertBefore(hit, original);
      });

    let magnetTarget: { id: string; x: number; y: number } | null = null;
    const magnetRadius = 10;

    connEnter.on("mousedown", (e, c) => {
      e.stopPropagation();
      if (c.type !== "out") return;
      setSelectedConnector(c.id);
      dragSourceRef.current = c.id;
      isDraggingRef.current = true;
      const gNode = gRef.current;
      if (!gNode) return;
      const [x, y] = d3.pointer(e, gNode);
      dragLineRef.current = d3
        .select(gNode)
        .append("line")
        .attr("class", "drag-temp")
        .attr("stroke", highlightColor)
        .attr("stroke-width", edgeWidth)
        .attr("pointer-events", "none")
        .attr("x1", x)
        .attr("y1", y)
        .attr("x2", x)
        .attr("y2", y);

      d3.select(svgRef.current)
        .on("mousemove.dragline", (ev) => {
          if (!isDraggingRef.current || !dragLineRef.current) return;
          const [mx, my] = d3.pointer(ev, gNode);
          magnetTarget = null;
          nodesRef.current.forEach((node) => {
            node.connectors.forEach((connItem) => {
              if (connItem.type !== "in") return;
              const w = node.width;
              const h = node.height;
              const dx = connItem.type === "in" ? 0 : w;
              const list = node.connectors.filter(
                (x) => x.type === connItem.type,
              );
              const idx = list.findIndex((x) => x.id === connItem.id);
              const spacing = list.length > 0 ? h / list.length : 0;
              const dy = spacing * idx + spacing / 2;
              const cx = node.x - w / 2 + dx;
              const cy = node.y - h / 2 + dy;
              const dist = Math.hypot(mx - cx, my - cy);
              if (dist < magnetRadius) {
                magnetTarget = { id: connItem.id, x: cx, y: cy };
              }
            });
          });

          if (magnetTarget) {
            const magnetH = magnetTarget as { x: number; y: number };
            dragLineRef.current.attr("x2", magnetH.x).attr("y2", magnetH.y);
          } else {
            dragLineRef.current.attr("x2", mx).attr("y2", my);
          }
        })
        .on("mouseup.dragline", (ev) => {
          d3.select(svgRef.current).on(".dragline", null);
          dragLineRef.current?.remove();
          dragLineRef.current = null;
          isDraggingRef.current = false;
          setSelectedConnector(null);
          let targetId: string | null = null;
          if (magnetTarget) {
            targetId = magnetTarget.id;
          } else {
            const targetEl = (ev.target as HTMLElement).closest(
              "g.connector",
            ) as SVGGElement | null;
            if (targetEl) {
              const type = targetEl.getAttribute("data-connector-type");
              const id = targetEl.getAttribute("data-connector-id");
              if (type === "in" && id) {
                targetId = id;
              }
            }
          }
          if (targetId && dragSourceRef.current) {
            const isExistConnection =
              edgesRef.current.filter((item) => {
                return (
                  item.source == dragSourceRef.current &&
                  item.target == targetId
                );
              }).length > 0;

            if (isExistConnection == false) {
              onEdgesChange?.([
                ...edgesRef.current,
                {
                  id: `${dragSourceRef.current}-${targetId}-${Date.now()}`,
                  source: dragSourceRef.current,
                  target: targetId,
                },
              ]);
            }
          }
          dragSourceRef.current = null;
          magnetTarget = null;
        });
    });

    nodesMerged.raise();
  }, [
    nodes,
    edges,
    locked,
    selectedConnector,
    selectedElement,
    edgeColor,
    edgeWidth,
    onNodesChange,
    onEdgesChange,
  ]);

  const handleZoom = useCallback((k: number) => {
    if (!zoomRef.current) return;
    if (!svgRef.current) return;

    const scaleBy = zoomRef.current.scaleBy;

    d3.select<SVGSVGElement, unknown>(svgRef.current)
      .transition()
      .duration(200)
      .call(scaleBy, k);
  }, []);

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
      }}
    >
      <svg ref={svgRef} width='100%' height='100%'>
        <g ref={gRef} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size={"sm"} variant={"secondary"}>
              <SquarePlus size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {nodeGroups.map((group) => (
              <DropdownMenuSub key={group.label}>
                <DropdownMenuSubTrigger>
                  <span>{group.label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {group.nodes.map((nodeType) => (
                      <DropdownMenuItem
                        key={nodeType}
                        onClick={() => handleAddNode(nodeType as NodeTypes)}
                      >
                        {formatConstantCase(nodeType)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size={"sm"}
          variant={"secondary"}
          onClick={() => handleZoom(1.2)}
        >
          <Plus size={18} />
        </Button>
        <Button
          size={"sm"}
          variant={"secondary"}
          onClick={() => handleZoom(0.8)}
        >
          <Minus size={18} />
        </Button>
        <Button
          size={"sm"}
          variant={"secondary"}
          onClick={() => setLocked((p) => !p)}
        >
          {locked ? <Lock size={18} /> : <LockOpen size={18} />}
        </Button>

        <Options
          open={open}
          selectedNode={openedNode}
          setOpen={handleOpenOptions}
        />
      </div>
    </div>
  );
}
