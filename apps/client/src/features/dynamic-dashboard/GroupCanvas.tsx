import { useEffect, useRef, useState } from "react";
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
import { Plus } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useFlowStore } from "@/entities/flow/store";
import { useMapDataStore } from "@/entities/map/store";
import { MapPanel } from "./panels/MapPanel";
import { FlowPanel } from "./panels/FlowPanel";

const isMapItem = (
  candidate: DashboardItem,
): candidate is DashboardItem<"map"> => candidate.type === "map";

const isFlowItem = (
  candidate: DashboardItem,
): candidate is DashboardItem<"flow"> => candidate.type === "flow";

const MOBILE_ROW_UNIT_PX = 28;

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

type ResizeState = {
  itemId: string;
  startX: number;
  startY: number;
  originSize: { w: number; h: number };
  originPos: { x: number; y: number };
  minSize: { w: number; h: number };
};

type GroupCanvasProps = {
  dashboardId: string;
  group: DashboardGroup;
  entities: EntityAll[];
  streamsState: StreamState[];
  editMode: boolean;
};

export function GroupCanvas({
  dashboardId,
  group,
  entities,
  streamsState,
  editMode,
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

  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

    const handleUp = () => {
      setDragging(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [cols, dashboardId, dragging, group.id, rows, updateItemLayout]);

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

      const maxW = cols - resizing.originPos.x;
      const maxH = rows - resizing.originPos.y;
      const nextW = Math.max(
        resizing.minSize.w,
        Math.min(maxW, resizing.originSize.w + dw),
      );
      const nextH = Math.max(
        resizing.minSize.h,
        Math.min(maxH, resizing.originSize.h + dh),
      );

      updateItemLayout(dashboardId, group.id, resizing.itemId, {
        size: { w: nextW, h: nextH },
      });
    };

    const handleUp = () => {
      setResizing(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
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

    if (item.type === "button") {
      return (
        <div className='flex h-full w-full items-center justify-center'>
          <Button
            className='w-full h-full'
            variant={"outline"}
            onClick={() => {
              // Placeholder client-side action until server hooks exist
              console.log("Button clicked", item.label);
            }}
          >
            {item.label || "Action"}
          </Button>
        </div>
      );
    }

    if (isMapItem(item)) {
      return (
        <MapPanel
          data={item.data}
          onLayerChange={(layerId) =>
            updateItemData(dashboardId, group.id, item.id, {
              data: { ...(item.data ?? {}), layerId },
            })
          }
        />
      );
    }

    if (isFlowItem(item)) {
      return (
        <FlowPanel
          data={item.data}
          onFlowChange={(flowId) =>
            updateItemData(dashboardId, group.id, item.id, {
              data: { ...(item.data ?? {}), flowId },
            })
          }
        />
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
              {editMode && (
                <button
                  type='button'
                  className='absolute right-2 top-2 z-30 h-6 w-6 rounded border bg-background/90 text-xs shadow-sm'
                  onClick={() => deleteItem(dashboardId, group.id, item.id)}
                >
                  ×
                </button>
              )}
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
            return (
              <div
                key={item.id}
                className='group relative min-h-0 min-w-0 overflow-hidden bg-card shadow-sm'
                style={{
                  gridColumn: `${item.position.x + 1} / span ${spanW}`,
                  gridRow: `${item.position.y + 1} / span ${spanH}`,
                  cursor:
                    editMode && resizing?.itemId === item.id
                      ? "se-resize"
                      : editMode
                        ? "grab"
                        : "default",
                }}
              >
                {editMode && (
                  <>
                    <div
                      className='absolute inset-0 z-10'
                      style={{ pointerEvents: "none" }}
                    />
                    <div className='absolute inset-0 z-20 hidden border border-primary/40 group-hover:block' />
                    <button
                      type='button'
                      className='absolute right-2 top-2 z-30 h-6 w-6 bg-background/80 text-xs shadow-sm'
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => deleteItem(dashboardId, group.id, item.id)}
                    >
                      ×
                    </button>
                    <div
                      className='absolute left-0 top-0 z-20 h-7 w-full cursor-grab bg-muted/60 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'
                      onPointerDown={(event) => {
                        event.preventDefault();
                        setResizing(null);
                        setDragging({
                          itemId: item.id,
                          startX: event.clientX,
                          startY: event.clientY,
                          origin: { ...item.position },
                        });
                      }}
                    >
                      <div className='flex h-full items-center justify-between'>
                        <span>{item.label || item.type}</span>
                        <span className='text-[9px] font-medium text-muted-foreground'>
                          {item.position.x},{item.position.y} • {item.size.w}×
                          {item.size.h}
                        </span>
                      </div>
                    </div>
                    <button
                      type='button'
                      aria-label='Resize item'
                      className='absolute bottom-0.5 right-0.5 z-40 h-3.5 w-3.5 cursor-se-resize border border-primary/20 bg-background p-0 touch-none'
                      onPointerDown={(event) => {
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
                        });
                      }}
                    />
                  </>
                )}

                <div
                  className='flex h-full min-h-0 flex-col p-2'
                  style={{ pointerEvents: editMode ? "none" : "auto" }}
                >
                  {renderItem(item)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
