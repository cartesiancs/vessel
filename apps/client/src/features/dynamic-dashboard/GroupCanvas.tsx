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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Plus } from "lucide-react";
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

const CELL_SIZE = 32;

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
  origin: { w: number; h: number };
};

type GroupCanvasProps = {
  dashboardId: string;
  group: DashboardGroup;
  entities: EntityAll[];
  streamsState: StreamState[];
  editMode: boolean;
  onDeleteGroup?: () => void;
};

export function GroupCanvas({
  dashboardId,
  group,
  entities,
  streamsState,
  editMode,
  onDeleteGroup,
}: GroupCanvasProps) {
  const { open, isMobile } = useSidebar();
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
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // const videoEntities = useMemo(
  //   () =>
  //     entities.filter(
  //       (e) => e.entity_type === "VIDEO" || e.platform === "RTSP",
  //     ),
  //   [entities],
  // );
  const cellSize = CELL_SIZE * scale;
  const gridWidth = group.cols * cellSize;
  const gridHeight = group.rows * cellSize;

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


  const parseSizeToPx = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    if (trimmed.endsWith("rem")) {
      return parseFloat(trimmed) * rootFontSize;
    }

    if (trimmed.endsWith("px")) {
      return parseFloat(trimmed);
    }

    const numeric = parseFloat(trimmed);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const baseWidth = group.cols * CELL_SIZE;

    const measureAvailableWidth = (entry: ResizeObserverEntry) => {
      const wrapper = el.closest(
        "[data-slot=sidebar-wrapper]",
      ) as HTMLElement | null;

      const wrapperWidth = wrapper?.clientWidth || entry.contentRect.width;

      let sidebarWidth = 0;
      if (wrapper && !isMobile) {
        const styles = getComputedStyle(wrapper);
        const widthValue = open
          ? styles.getPropertyValue("--sidebar-width")
          : styles.getPropertyValue("--sidebar-width-icon");
        sidebarWidth = parseSizeToPx(widthValue);
      }

      return Math.max(0, wrapperWidth - sidebarWidth);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const availableWidth = measureAvailableWidth(entry);
        const nextScale = availableWidth / baseWidth;
        if (nextScale > 0) {
          setScale((prev) =>
            Math.abs(prev - nextScale) > 0.01 ? nextScale : prev,
          );
        }
      });
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [group.cols, open, isMobile]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const dx = Math.round((event.clientX - dragging.startX) / cellSize);
      const dy = Math.round((event.clientY - dragging.startY) / cellSize);

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
  }, [dashboardId, dragging, group.id, updateItemLayout]);

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const dx = Math.round((event.clientX - resizing.startX) / cellSize);
      const dy = Math.round((event.clientY - resizing.startY) / cellSize);

      const next = {
        w: Math.max(1, resizing.origin.w + dx),
        h: Math.max(1, resizing.origin.h + dy),
      };

      updateItemLayout(dashboardId, group.id, resizing.itemId, {
        size: next,
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
  }, [dashboardId, group.id, resizing, updateItemLayout]);

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

  return (
    <Card className='py-4 border-0'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2 px-4'>
          <p className='text-sm font-semibold'>{group.title}</p>
          <Badge variant='outline'>
            {group.cols}x{group.rows}
          </Badge>
        </div>
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
          {onDeleteGroup && (
            <Button
              variant='ghost'
              size='icon'
              onClick={onDeleteGroup}
              title='Delete group'
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          )}
        </div>
      </div>

      <div className='w-full overflow-auto' ref={containerRef}>
        <div
          className='relative overflow-hidden bg-muted/40'
          style={{
            width: gridWidth,
            height: gridHeight,
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)",
            backgroundSize: `${cellSize}px ${cellSize}px`,
          }}
        >
          {group.items.map((item) => (
            <div
              key={item.id}
              className='group absolute overflow-hidden bg-card shadow-sm'
              style={{
                width: item.size.w * cellSize,
                height: item.size.h * cellSize,
                transform: `translate(${item.position.x * cellSize}px, ${
                  item.position.y * cellSize
                }px)`,
                cursor: editMode ? "grab" : "default",
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
                        {item.position.x},{item.position.y} • {item.size.w}x
                        {item.size.h}
                      </span>
                    </div>
                  </div>
                  <div
                    className='absolute bottom-1 right-1 z-30 h-3 w-3 cursor-nwse-resize bg-primary/50'
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setResizing({
                        itemId: item.id,
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: { ...item.size },
                      });
                    }}
                  />
                </>
              )}

              <div
                className='flex h-full flex-col p-2'
                style={{ pointerEvents: editMode ? "none" : "auto" }}
              >
                {renderItem(item)}
              </div>
            </div>
          ))}
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
