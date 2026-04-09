import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DashboardGroup,
  DashboardItem,
  useDynamicDashboardStore,
} from "@/entities/dynamic-dashboard/store";
import { EntityAll } from "@/entities/entity/types";
import { StreamState } from "@/features/entity/useEntitiesData";
import { EntityCard } from "@/features/entity/Card";
import { StreamReceiver } from "@/features/rtc/StreamReceiver";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, X } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useFlowStore } from "@/entities/flow/store";
import { useMapDataStore } from "@/entities/map/store";
import { MapPanel } from "./panels/MapPanel";
import { FlowPanel } from "./panels/FlowPanel";
import { useWebSocket } from "@/features/ws/WebSocketProvider";
import { getFlowRunSessionId } from "@/features/ws/ws";
import { createDashboardEventDispatcher } from "./events/dispatcher";
import { isValidListenerId } from "@/entities/dynamic-dashboard/interaction";

const isMapItem = (
  candidate: DashboardItem,
): candidate is DashboardItem<"map"> => candidate.type === "map";

const isFlowItem = (
  candidate: DashboardItem,
): candidate is DashboardItem<"flow"> => candidate.type === "flow";

const isButtonItem = (
  candidate: DashboardItem,
): candidate is DashboardItem<"button"> => candidate.type === "button";

const MOBILE_ROW_UNIT_PX = 28;

/** Viewport Y (px): show delete drop target while dragging above this line. */
const DRAG_DELETE_SHOW_MAX_CLIENT_Y = 100;

/** Fixed delete chip below app header (~h-12). */
const DRAG_DELETE_TARGET_TOP = "3.5rem";

/** Clamp span so position + span stays within the grid (CSS grid 1×1…N tracks). */
function clampGridSpan(position: number, span: number, limit: number): number {
  const maxSpan = Math.max(1, limit - position);
  return Math.max(1, Math.min(span, maxSpan));
}

type DragState = {
  itemId: string;
  startX: number;
  startY: number;
  origin: { x: number; y: number };
};

/** Which edge/corner is being dragged for frame resize. */
type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ResizeState = {
  itemId: string;
  startX: number;
  startY: number;
  originSize: { w: number; h: number };
  originPos: { x: number; y: number };
  minSize: { w: number; h: number };
  edge: ResizeEdge;
};

const FRAME_STRIP_CLASS =
  "absolute z-[25] touch-none border-0 bg-transparent p-0";

function resizeCursorForEdge(edge: ResizeEdge): string {
  switch (edge) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    default:
      return "default";
  }
}

function startResize(
  event: ReactPointerEvent<Element>,
  item: DashboardItem,
  edge: ResizeEdge,
  setDragging: (v: DragState | null) => void,
  setResizing: (v: ResizeState | null) => void,
) {
  event.preventDefault();
  event.stopPropagation();
  setDragging(null);
  setResizing({
    itemId: item.id,
    startX: event.clientX,
    startY: event.clientY,
    originSize: { ...item.size },
    originPos: { ...item.position },
    minSize: { ...item.minSize },
    edge,
  });
}

type GroupCanvasProps = {
  dashboardId: string;
  group: DashboardGroup;
  entities: EntityAll[];
  streamsState: StreamState[];
};

export function GroupCanvas({
  dashboardId,
  group,
  entities,
  streamsState,
}: GroupCanvasProps) {
  const { isMobile } = useSidebar();
  const addItem = useDynamicDashboardStore((state) => state.addItem);
  const updateItemLayout = useDynamicDashboardStore(
    (state) => state.updateItemLayout,
  );
  const updateItemData = useDynamicDashboardStore(
    (state) => state.updateItemData,
  );
  const deleteItem = useDynamicDashboardStore((state) => state.deleteItem);
  const { layers, fetchAllLayers } = useMapDataStore();
  const { flows, fetchFlows } = useFlowStore();
  const { wsManager } = useWebSocket();

  const dashboardDispatcher = useMemo(
    () =>
      createDashboardEventDispatcher({
        send: (msg) => wsManager?.send(msg),
        isConnected: () => wsManager?.isConnected() ?? false,
      }),
    [wsManager],
  );

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [dragNearTopForDelete, setDragNearTopForDelete] = useState(false);
  const [dragOverDeleteTarget, setDragOverDeleteTarget] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const deleteDropTargetRef = useRef<HTMLDivElement | null>(null);

  const cols = Math.max(1, group.cols);
  const rows = Math.max(1, group.rows);

  const findEntityByRef = (refId?: string) => {
    if (!refId) return undefined;
    return (
      entities.find((e) => e.entity_id === refId) ||
      entities.find((e) => String(e.id) === refId)
    );
  };

  useEffect(() => {
    if (!dragging) {
      setDragNearTopForDelete(false);
      setDragOverDeleteTarget(false);
    }
  }, [dragging]);

  useEffect(() => {
    if (layers.length === 0) {
      fetchAllLayers().catch((err) => {
        console.error("Failed to load layers for dashboard", err);
      });
    }
    if (flows.length === 0) {
      fetchFlows().catch((err) => {
        console.error("Failed to load flows for dashboard", err);
      });
    }
  }, [fetchAllLayers, fetchFlows, flows.length, layers.length]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const nearTop = event.clientY < DRAG_DELETE_SHOW_MAX_CLIENT_Y;
      setDragNearTopForDelete((prev) => (prev === nearTop ? prev : nearTop));

      let overDelete = false;
      const targetEl = deleteDropTargetRef.current;
      if (targetEl && nearTop) {
        const tr = targetEl.getBoundingClientRect();
        overDelete =
          event.clientX >= tr.left &&
          event.clientX <= tr.right &&
          event.clientY >= tr.top &&
          event.clientY <= tr.bottom;
      }
      setDragOverDeleteTarget((prev) =>
        prev === overDelete ? prev : overDelete,
      );

      if (overDelete) {
        return;
      }

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cellW = rect.width / cols;
      const cellH = rect.height / rows;
      if (cellW < 1e-6 || cellH < 1e-6) return;

      const dx = Math.round((event.clientX - dragging.startX) / cellW);
      const dy = Math.round((event.clientY - dragging.startY) / cellH);

      const next = {
        x: dragging.origin.x + dx,
        y: dragging.origin.y + dy,
      };

      updateItemLayout(dashboardId, group.id, dragging.itemId, {
        position: next,
      });
    };

    const handleUp = (event: PointerEvent) => {
      const targetEl = deleteDropTargetRef.current;
      if (targetEl && dragging) {
        const tr = targetEl.getBoundingClientRect();
        const inside =
          event.clientX >= tr.left &&
          event.clientX <= tr.right &&
          event.clientY >= tr.top &&
          event.clientY <= tr.bottom;
        if (inside) {
          deleteItem(dashboardId, group.id, dragging.itemId);
        }
      }
      setDragNearTopForDelete(false);
      setDragOverDeleteTarget(false);
      setDragging(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [
    cols,
    dashboardId,
    deleteItem,
    dragging,
    group.id,
    rows,
    updateItemLayout,
  ]);

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cellW = rect.width / cols;
      const cellH = rect.height / rows;
      if (cellW < 1e-6 || cellH < 1e-6) return;

      const dw = Math.round((event.clientX - resizing.startX) / cellW);
      const dh = Math.round((event.clientY - resizing.startY) / cellH);

      const { originPos, originSize, minSize, edge } = resizing;
      let nextX = originPos.x;
      let nextY = originPos.y;
      let nextW = originSize.w;
      let nextH = originSize.h;

      const maxGrowW = cols - originPos.x;
      const maxGrowH = rows - originPos.y;
      const rightEdge = originPos.x + originSize.w;
      const bottomEdge = originPos.y + originSize.h;

      switch (edge) {
        case "se": {
          nextW = Math.max(minSize.w, Math.min(maxGrowW, originSize.w + dw));
          nextH = Math.max(minSize.h, Math.min(maxGrowH, originSize.h + dh));
          break;
        }
        case "e": {
          nextW = Math.max(minSize.w, Math.min(maxGrowW, originSize.w + dw));
          break;
        }
        case "s": {
          nextH = Math.max(minSize.h, Math.min(maxGrowH, originSize.h + dh));
          break;
        }
        case "w": {
          let x = originPos.x + dw;
          x = Math.max(0, x);
          x = Math.min(x, rightEdge - minSize.w);
          nextW = rightEdge - x;
          nextX = x;
          break;
        }
        case "n": {
          let y = originPos.y + dh;
          y = Math.max(0, y);
          y = Math.min(y, bottomEdge - minSize.h);
          nextH = bottomEdge - y;
          nextY = y;
          break;
        }
        case "ne": {
          nextW = Math.max(minSize.w, Math.min(maxGrowW, originSize.w + dw));
          let y = originPos.y + dh;
          y = Math.max(0, y);
          y = Math.min(y, bottomEdge - minSize.h);
          nextH = bottomEdge - y;
          nextY = y;
          break;
        }
        case "nw": {
          let x = originPos.x + dw;
          x = Math.max(0, x);
          x = Math.min(x, rightEdge - minSize.w);
          nextW = rightEdge - x;
          nextX = x;
          let y = originPos.y + dh;
          y = Math.max(0, y);
          y = Math.min(y, bottomEdge - minSize.h);
          nextH = bottomEdge - y;
          nextY = y;
          break;
        }
        case "sw": {
          let x = originPos.x + dw;
          x = Math.max(0, x);
          x = Math.min(x, rightEdge - minSize.w);
          nextW = rightEdge - x;
          nextX = x;
          nextH = Math.max(minSize.h, Math.min(maxGrowH, originSize.h + dh));
          break;
        }
        default:
          break;
      }

      updateItemLayout(dashboardId, group.id, resizing.itemId, {
        position: { x: nextX, y: nextY },
        size: { w: nextW, h: nextH },
      });
    };

    const handleUp = () => {
      setResizing(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [cols, dashboardId, group.id, resizing, rows, updateItemLayout]);

  const handleAddEntityCard = (entityId?: string) => {
    if (!entityId) return;
    addItem(dashboardId, group.id, {
      type: "entity-card",
      refId: entityId,
      label: "Entity",
    });
  };

  // const handleAddEntityText = (entityId?: string) => {
  //   if (!entityId) return;
  //   addItem(dashboardId, group.id, {
  //     type: "entity-text",
  //     refId: entityId,
  //     label: "Entity Text",
  //   });
  // };

  // const handleAddMedia = (entityId?: string) => {
  //   if (!entityId) return;
  //   addItem(dashboardId, group.id, {
  //     type: "media",
  //     refId: entityId,
  //     label: "Media",
  //   });
  // };

  const handleAddButton = () => {
    addItem(dashboardId, group.id, {
      type: "button",
      label: "Action",
      data: {},
    });
  };

  const handleAddMapPanel = (layerId: number) => {
    addItem(dashboardId, group.id, {
      type: "map",
      label: "Map",
      data: { layerId },
    });
  };

  const handleAddFlowPanel = (flowId: number) => {
    addItem(dashboardId, group.id, {
      type: "flow",
      label: "Flow",
      data: { flowId },
    });
  };

  const renderItem = (item: DashboardItem) => {
    if (item.type === "entity-card") {
      const entity = findEntityByRef(item.refId);
      if (!entity) {
        return <Placeholder text='Entity not found' />;
      }
      return <EntityCard item={entity} streamsState={streamsState} />;
    }

    if (item.type === "entity-text") {
      const entity = findEntityByRef(item.refId);
      if (!entity) {
        return <Placeholder text='Entity not found' />;
      }
      return (
        <div className='flex h-full flex-col justify-between'>
          <div>
            <p className='text-sm text-muted-foreground'>
              {entity.friendly_name}
            </p>
            <p className='text-3xl font-semibold'>
              {entity.state?.state ?? "N/A"}
            </p>
          </div>
          <p className='text-xs text-muted-foreground'>{entity.platform}</p>
        </div>
      );
    }

    if (item.type === "media") {
      const entity = findEntityByRef(item.refId);
      const topic =
        (entity?.configuration?.state_topic as string) ||
        (entity?.configuration?.rtsp_url as string);

      if (!topic) {
        return <Placeholder text='No stream topic' />;
      }

      return (
        <div className='h-full w-full'>
          <StreamReceiver topic={topic} streamType='video' />
        </div>
      );
    }

    if (isButtonItem(item)) {
      const listenerId = item.data?.listener_id?.trim() ?? "";
      const handleButtonClick = () => {
        if (!listenerId || !isValidListenerId(listenerId)) {
          toast.message("Configure the button", {
            description: "Set a listener id (letters, numbers, _ and - only).",
          });
          return;
        }
        dashboardDispatcher.dispatch({
          dashboard_id: dashboardId,
          group_id: group.id,
          item_id: item.id,
          listener_id: listenerId,
          component_type: "button",
          action: "click",
          source_session_id: getFlowRunSessionId(),
          debounce_ms: item.data?.debounce_ms,
          cooldown_ms: item.data?.cooldown_ms,
        });
      };

      return (
        <div className='pointer-events-auto flex h-full min-h-0 w-full flex-col gap-2'>
          <div className='flex min-h-0 flex-1 items-stretch justify-center'>
            <Button
              className='h-full w-full'
              variant='outline'
              type='button'
              onClick={handleButtonClick}
            >
              {item.label || "Action"}
            </Button>
          </div>
        </div>
      );
    }

    if (isMapItem(item)) {
      return (
        <div className='pointer-events-auto flex h-full min-h-0 w-full flex-col'>
          <MapPanel
            data={item.data}
            onLayerChange={(layerId) =>
              updateItemData(dashboardId, group.id, item.id, {
                data: { ...(item.data ?? {}), layerId },
              })
            }
          />
        </div>
      );
    }

    if (isFlowItem(item)) {
      return (
        <div className='pointer-events-auto flex h-full min-h-0 w-full flex-col'>
          <FlowPanel
            data={item.data}
            onFlowChange={(flowId) =>
              updateItemData(dashboardId, group.id, item.id, {
                data: { ...(item.data ?? {}), flowId },
              })
            }
          />
        </div>
      );
    }

    return <Placeholder text='Unknown item' />;
  };

  const groupToolbar = (
    <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
      <div className='flex items-center gap-2 px-4'></div>
      <div className='flex flex-wrap items-center gap-2 px-4'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm'>
              <Plus className='h-4 w-4 mr-1' />
              Add Item
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Add Entity</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {entities.map((entity) => (
                  <DropdownMenuItem
                    key={entity.id}
                    onClick={() => handleAddEntityCard(entity.entity_id)}
                  >
                    {entity.friendly_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={handleAddButton}>
              Add Button
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={layers.length === 0}>
                Add Map
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {layers.map((layer) => (
                  <DropdownMenuItem
                    key={layer.id}
                    onClick={() => handleAddMapPanel(layer.id)}
                  >
                    {layer.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={flows.length === 0}>
                Add Flow
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {flows.map((flow) => (
                  <DropdownMenuItem
                    key={flow.id}
                    onClick={() => handleAddFlowPanel(flow.id)}
                  >
                    {flow.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Card className='flex flex-col border-0 py-4'>
        {groupToolbar}
        <div className='flex flex-col gap-3 px-4'>
          {group.items.map((item) => (
            <div
              key={item.id}
              className='relative overflow-hidden rounded-lg border bg-card shadow-sm'
              style={{
                minHeight: Math.max(120, item.size.h * MOBILE_ROW_UNIT_PX),
              }}
            >
              <div className='flex h-full min-h-0 flex-col p-2'>
                {renderItem(item)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className='flex h-full min-h-0 flex-col border-0 py-4'>
      {groupToolbar}

      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
        <div
          ref={containerRef}
          className='grid h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-background'
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)",
            backgroundSize: `calc(100% / ${cols}) calc(100% / ${rows})`,
          }}
        >
          {group.items.map((item) => {
            const spanW = clampGridSpan(item.position.x, item.size.w, cols);
            const spanH = clampGridSpan(item.position.y, item.size.h, rows);
            const activeResizeEdge =
              resizing?.itemId === item.id ? resizing.edge : null;
            return (
              <div
                key={item.id}
                className='relative min-h-0 min-w-0 overflow-hidden bg-card shadow-sm'
                style={{
                  gridColumn: `${item.position.x + 1} / span ${spanW}`,
                  gridRow: `${item.position.y + 1} / span ${spanH}`,
                  cursor: activeResizeEdge
                    ? resizeCursorForEdge(activeResizeEdge)
                    : "default",
                }}
              >
                <div className='group/movehit pointer-events-auto absolute inset-x-0 top-2 z-[36] h-12'>
                  <button
                    type='button'
                    aria-label={`Move ${item.label || item.type}`}
                    className='pointer-events-none absolute left-1/2 top-1 z-[37] h-2 w-14 shrink-0 -translate-x-1/2 cursor-grab rounded-full bg-white opacity-0 shadow-sm transition-opacity duration-200 group-hover/movehit:pointer-events-auto group-hover/movehit:opacity-100 active:cursor-grabbing'
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setResizing(null);
                      setDragNearTopForDelete(false);
                      setDragOverDeleteTarget(false);
                      setDragging({
                        itemId: item.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: { ...item.position },
                      });
                    }}
                  />
                </div>

                <button
                  type='button'
                  aria-label='Resize from top edge'
                  className={`${FRAME_STRIP_CLASS} left-2 right-2 top-0 h-2 cursor-ns-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "n", setDragging, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from bottom edge'
                  className={`${FRAME_STRIP_CLASS} bottom-0 left-2 right-2 h-2 cursor-ns-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "s", setDragging, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from left edge'
                  className={`${FRAME_STRIP_CLASS} bottom-2 left-0 top-2 w-2 cursor-ew-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "w", setDragging, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from right edge'
                  className={`${FRAME_STRIP_CLASS} bottom-2 right-0 top-2 w-2 cursor-ew-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "e", setDragging, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from top-left'
                  className={`${FRAME_STRIP_CLASS} left-0 top-0 h-3 w-3 cursor-nwse-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "nw", setDragging, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from top-right'
                  className={`${FRAME_STRIP_CLASS} right-0 top-0 h-3 w-3 cursor-nesw-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "ne", setDragging, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from bottom-left'
                  className={`${FRAME_STRIP_CLASS} bottom-0 left-0 h-3 w-3 cursor-nesw-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "sw", setDragging, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from bottom-right'
                  className={`${FRAME_STRIP_CLASS} bottom-0 right-0 h-3 w-3 cursor-nwse-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "se", setDragging, setResizing)
                  }
                />

                <div className='relative z-0 flex h-full min-h-0 flex-col p-2'>
                  {renderItem(item)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dragging && dragNearTopForDelete ? (
        <div
          ref={deleteDropTargetRef}
          className={`pointer-events-none fixed left-1/2 z-[300] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-dark transition-[transform,box-shadow] ${
            dragOverDeleteTarget ? "scale-110" : "scale-100"
          } `}
          style={{ top: DRAG_DELETE_TARGET_TOP }}
          aria-hidden
        >
          <X className='h-7 w-7 text-white' strokeWidth={2.25} />
        </div>
      ) : null}
    </Card>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className='flex h-full items-center justify-center border border-dashed text-xs text-muted-foreground'>
      {text}
    </div>
  );
}
