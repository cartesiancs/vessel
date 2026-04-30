import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { resolveItemPositionOrNull } from "@/entities/dynamic-dashboard";
import {
  DashboardGroup,
  DashboardItem,
  useDynamicDashboardStore,
} from "@/entities/dynamic-dashboard";
import { EntityAll } from "@/entities/entity";
import { StreamState } from "@/features/entity";
import { EntityCard } from "@/features/entity";
import { StreamReceiver } from "@/features/rtc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Plus, X } from "lucide-react";
import { useSidebar } from "@/shared/ui/sidebar";
import { useFlowStore } from "@/entities/flow";
import { useMapDataStore } from "@/entities/map";
import { MapPanel } from "./panels/MapPanel";
import { FlowPanel } from "./panels/FlowPanel";
import { useWebSocket } from "@/features/ws";
import { getFlowRunSessionId } from "@/features/ws";
import { createDashboardEventDispatcher } from "../lib/events/dispatcher";
import { isValidListenerId } from "@/entities/dynamic-dashboard";

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

/** Spring for smooth magnet-snap motion — near-critical damping for minimal overshoot. */
const DRAG_SPRING_STIFFNESS = 400;
const DRAG_SPRING_DAMPING = 40;

type Vec2 = { x: number; y: number };

type DragSpringSim = {
  px: number;
  py: number;
  vx: number;
  vy: number;
};

/** Clamp span so position + span stays within the grid (CSS grid 1×1…N tracks). */
function clampGridSpan(position: number, span: number, limit: number): number {
  const maxSpan = Math.max(1, limit - position);
  return Math.max(1, Math.min(span, maxSpan));
}

/** Session data for an active drag (stable across preview updates → effect does not rebind on each cell). */
type DragSessionState = {
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
  clearDrag: () => void,
  setResizing: (v: ResizeState | null) => void,
) {
  event.preventDefault();
  event.stopPropagation();
  clearDrag();
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

  const [dragSession, setDragSession] = useState<DragSessionState | null>(null);
  const dragPreviewRef = useRef<{ x: number; y: number } | null>(null);
  const dragSpringTargetRef = useRef<Vec2>({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [dragNearTopForDelete, setDragNearTopForDelete] = useState(false);
  const [dragOverDeleteTarget, setDragOverDeleteTarget] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const deleteDropTargetRef = useRef<HTMLDivElement | null>(null);
  const [editingButtonItem, setEditingButtonItem] =
    useState<DashboardItem<"button"> | null>(null);

  const dragSpringSimRef = useRef<DragSpringSim>({
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
  });
  const dragSpringRafRef = useRef<number | null>(null);
  const dragSpringLastTRef = useRef<number | null>(null);
  const [dragSpringVisual, setDragSpringVisual] = useState<Vec2>({
    x: 0,
    y: 0,
  });
  const resetDragSpring = useCallback(() => {
    if (dragSpringRafRef.current != null) {
      cancelAnimationFrame(dragSpringRafRef.current);
      dragSpringRafRef.current = null;
    }
    dragSpringLastTRef.current = null;
    dragSpringSimRef.current = { px: 0, py: 0, vx: 0, vy: 0 };
    setDragSpringVisual({ x: 0, y: 0 });
  }, []);

  const ensureDragSpringLoop = useCallback(() => {
    if (dragSpringRafRef.current != null) return;
    dragSpringLastTRef.current = performance.now();

    const tick = (now: number) => {
      const last = dragSpringLastTRef.current ?? now;
      const dt = Math.min((now - last) / 1000, 0.064);
      dragSpringLastTRef.current = now;

      const s = dragSpringSimRef.current;
      const t = dragSpringTargetRef.current;
      const k = DRAG_SPRING_STIFFNESS;
      const c = DRAG_SPRING_DAMPING;
      const errX = s.px - t.x;
      const errY = s.py - t.y;
      const ax = -k * errX - c * s.vx;
      const ay = -k * errY - c * s.vy;
      s.vx += ax * dt;
      s.vy += ay * dt;
      s.px += s.vx * dt;
      s.py += s.vy * dt;

      setDragSpringVisual({ x: s.px, y: s.py });

      const settled =
        Math.abs(errX) < 0.4 &&
        Math.abs(errY) < 0.4 &&
        Math.abs(s.vx) < 8 &&
        Math.abs(s.vy) < 8;

      if (settled) {
        s.px = t.x;
        s.py = t.y;
        s.vx = s.vy = 0;
        setDragSpringVisual({ x: t.x, y: t.y });
        dragSpringRafRef.current = null;
        dragSpringLastTRef.current = null;
        return;
      }

      dragSpringRafRef.current = requestAnimationFrame(tick);
    };

    dragSpringRafRef.current = requestAnimationFrame(tick);
  }, []);

  const clearDrag = useCallback(() => {
    resetDragSpring();
    dragSpringTargetRef.current = { x: 0, y: 0 };
    setDragSession(null);
    dragPreviewRef.current = null;
    setDragNearTopForDelete(false);
    setDragOverDeleteTarget(false);
  }, [resetDragSpring]);

  useEffect(() => {
    return () => {
      if (dragSpringRafRef.current != null) {
        cancelAnimationFrame(dragSpringRafRef.current);
      }
    };
  }, []);

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
    if (!dragSession) {
      setDragNearTopForDelete(false);
      setDragOverDeleteTarget(false);
    }
  }, [dragSession]);

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
    if (!dragSession) {
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

      const dx = Math.round((event.clientX - dragSession.startX) / cellW);
      const dy = Math.round((event.clientY - dragSession.startY) / cellH);

      const desired = {
        x: dragSession.origin.x + dx,
        y: dragSession.origin.y + dy,
      };

      const dash = useDynamicDashboardStore
        .getState()
        .dashboards.find((d) => d.id === dashboardId);
      const g = dash?.groups.find((gr) => gr.id === group.id);
      const movingItem = g?.items.find((it) => it.id === dragSession.itemId);
      if (!g || !movingItem) return;

      const resolved = resolveItemPositionOrNull(g, movingItem, desired);
      if (!resolved) {
        return;
      }

      const prev = dragPreviewRef.current ?? dragSession.origin;
      if (prev.x === resolved.x && prev.y === resolved.y) {
        return;
      }

      dragPreviewRef.current = resolved;
      dragSpringTargetRef.current = {
        x: (resolved.x - dragSession.origin.x) * cellW,
        y: (resolved.y - dragSession.origin.y) * cellH,
      };
      ensureDragSpringLoop();
    };

    const handleUp = (event: PointerEvent) => {
      const session = dragSession;
      const finalPreview = dragPreviewRef.current;

      const targetEl = deleteDropTargetRef.current;
      let droppedOnDelete = false;
      if (targetEl && session) {
        const tr = targetEl.getBoundingClientRect();
        droppedOnDelete =
          event.clientX >= tr.left &&
          event.clientX <= tr.right &&
          event.clientY >= tr.top &&
          event.clientY <= tr.bottom;
      }

      if (droppedOnDelete && session) {
        deleteItem(dashboardId, group.id, session.itemId);
        clearDrag();
        return;
      }

      if (session && finalPreview) {
        const stored = useDynamicDashboardStore
          .getState()
          .dashboards.find((d) => d.id === dashboardId)
          ?.groups.find((gr) => gr.id === group.id)
          ?.items.find((it) => it.id === session.itemId);
        if (
          stored &&
          (stored.position.x !== finalPreview.x ||
            stored.position.y !== finalPreview.y)
        ) {
          updateItemLayout(dashboardId, group.id, session.itemId, {
            position: finalPreview,
          });
        }
      }

      clearDrag();
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
    clearDrag,
    cols,
    dashboardId,
    deleteItem,
    dragSession,
    ensureDragSpringLoop,
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
            const isMoveDragging = dragSession?.itemId === item.id;
            const displayPos = isMoveDragging
              ? dragSession.origin
              : item.position;
            const spanW = clampGridSpan(displayPos.x, item.size.w, cols);
            const spanH = clampGridSpan(displayPos.y, item.size.h, rows);
            const activeResizeEdge =
              resizing?.itemId === item.id ? resizing.edge : null;
            const springFollows = isMoveDragging;
            return (
              <div
                key={item.id}
                className='relative min-h-0 min-w-0 overflow-hidden bg-card shadow-sm'
                style={{
                  gridColumn: `${displayPos.x + 1} / span ${spanW}`,
                  gridRow: `${displayPos.y + 1} / span ${spanH}`,
                  cursor: activeResizeEdge
                    ? resizeCursorForEdge(activeResizeEdge)
                    : "default",
                  transform: springFollows
                    ? `translate3d(${dragSpringVisual.x}px, ${dragSpringVisual.y}px, 0)`
                    : undefined,
                  zIndex: springFollows ? 80 : undefined,
                  willChange: springFollows ? "transform" : undefined,
                }}
              >
                <div className='group/movehit pointer-events-auto absolute inset-x-0 top-2 z-[36] h-3'>
                  <button
                    type='button'
                    aria-label={`Move ${item.label || item.type}`}
                    className='pointer-events-none absolute left-1/2 top-1 z-[37] h-2 w-14 shrink-0 -translate-x-1/2 cursor-grab touch-none rounded-full bg-white opacity-0 shadow-sm transition-opacity duration-200 group-hover/movehit:pointer-events-auto group-hover/movehit:opacity-100 active:cursor-grabbing'
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (isButtonItem(item)) {
                        setEditingButtonItem(item);
                      }
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setResizing(null);
                      resetDragSpring();
                      setDragNearTopForDelete(false);
                      setDragOverDeleteTarget(false);
                      const origin = { ...item.position };
                      dragPreviewRef.current = origin;
                      dragSpringTargetRef.current = { x: 0, y: 0 };
                      setDragSession({
                        itemId: item.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        origin,
                      });
                    }}
                  />
                </div>

                <button
                  type='button'
                  aria-label='Resize from top edge'
                  className={`${FRAME_STRIP_CLASS} left-2 right-2 top-0 h-2 cursor-ns-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "n", clearDrag, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from bottom edge'
                  className={`${FRAME_STRIP_CLASS} bottom-0 left-2 right-2 h-2 cursor-ns-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "s", clearDrag, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from left edge'
                  className={`${FRAME_STRIP_CLASS} bottom-2 left-0 top-2 w-2 cursor-ew-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "w", clearDrag, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from right edge'
                  className={`${FRAME_STRIP_CLASS} bottom-2 right-0 top-2 w-2 cursor-ew-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "e", clearDrag, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from top-left'
                  className={`${FRAME_STRIP_CLASS} left-0 top-0 h-3 w-3 cursor-nwse-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "nw", clearDrag, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from top-right'
                  className={`${FRAME_STRIP_CLASS} right-0 top-0 h-3 w-3 cursor-nesw-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "ne", clearDrag, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from bottom-left'
                  className={`${FRAME_STRIP_CLASS} bottom-0 left-0 h-3 w-3 cursor-nesw-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "sw", clearDrag, setResizing)
                  }
                />
                <button
                  type='button'
                  aria-label='Resize from bottom-right'
                  className={`${FRAME_STRIP_CLASS} bottom-0 right-0 h-3 w-3 cursor-nwse-resize`}
                  onPointerDown={(e) =>
                    startResize(e, item, "se", clearDrag, setResizing)
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

      {dragSession && dragNearTopForDelete ? (
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

      <Dialog
        open={editingButtonItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingButtonItem(null);
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Edit Button</DialogTitle>
          </DialogHeader>
          {editingButtonItem && (
            <ButtonConfigEditor
              item={editingButtonItem}
              onSave={(data) => {
                updateItemData(dashboardId, group.id, editingButtonItem.id, {
                  data,
                  label: data.label,
                });
                setEditingButtonItem(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

type ButtonConfigEditorProps = {
  item: DashboardItem<"button">;
  onSave: (data: { listener_id?: string; label?: string }) => void;
};

function ButtonConfigEditor({ item, onSave }: ButtonConfigEditorProps) {
  const [listenerId, setListenerId] = useState(item.data?.listener_id ?? "");
  const [label, setLabel] = useState(item.label ?? "");

  const handleSave = () => {
    const trimmedId = listenerId.trim();
    if (trimmedId && !isValidListenerId(trimmedId)) {
      toast.error("Invalid listener ID", {
        description: "Use only letters, numbers, _ and -",
      });
      return;
    }
    onSave({
      listener_id: trimmedId || undefined,
      label: label.trim() || undefined,
    });
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid gap-2'>
        <Label htmlFor='button-label'>Label</Label>
        <Input
          id='button-label'
          value={label}
          placeholder='Button text'
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='listener-id'>Listener ID</Label>
        <Input
          id='listener-id'
          className='font-mono'
          value={listenerId}
          placeholder='e.g. lights-toggle'
          onChange={(e) => setListenerId(e.target.value)}
        />
      </div>
      <Button onClick={handleSave}>Save</Button>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className='flex h-full items-center justify-center border border-dashed text-xs text-muted-foreground'>
      {text}
    </div>
  );
}
