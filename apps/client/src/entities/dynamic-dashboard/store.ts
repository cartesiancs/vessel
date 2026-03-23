import { create } from "zustand";
import * as api from "./api";

export type DashboardItemType =
  | "entity-card"
  | "entity-text"
  | "media"
  | "button"
  | "map"
  | "flow";

export type DashboardItemDataMap = {
  "entity-card": Record<string, never>;
  "entity-text": Record<string, never>;
  media: Record<string, never>;
  button: { action?: string };
  map: {
    layerId?: number;
    center?: [number, number];
    zoom?: number;
  };
  flow: {
    flowId?: number;
    autoRun?: boolean;
  };
};

export type DashboardItem<T extends DashboardItemType = DashboardItemType> = {
  id: string;
  type: T;
  label?: string;
  refId?: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  minSize: { w: number; h: number };
  data?: DashboardItemDataMap[T];
};

export type DashboardGroup = {
  id: string;
  title: string;
  cols: number;
  rows: number;
  items: DashboardItem[];
};

export type DynamicDashboard = {
  id: string;
  name: string;
  groups: DashboardGroup[];
};

type LayoutPayload = {
  position?: { x: number; y: number };
  size?: { w: number; h: number };
};

type CreateItemPayload = {
  type: DashboardItemType;
  label?: string;
  refId?: string;
  data?: DashboardItemDataMap[DashboardItemType];
  size?: { w: number; h: number };
  minSize?: { w: number; h: number };
};

export interface DynamicDashboardState {
  dashboards: DynamicDashboard[];
  activeDashboardId?: string;
  isLoading: boolean;
  hasLoaded: boolean;
  error?: string | null;
  loadDashboards: () => Promise<void>;
  createDashboard: (name?: string) => Promise<string | null>;
  cloneDashboard: (dashboardId: string) => Promise<string | null>;
  deleteDashboard: (dashboardId: string) => Promise<void>;
  setActiveDashboard: (dashboardId?: string) => void;
  updateDashboardMeta: (
    dashboardId: string,
    data: Partial<Pick<DynamicDashboard, "name">>,
  ) => void;
  addItem: (
    dashboardId: string,
    groupId: string,
    payload: CreateItemPayload,
  ) => string | null;
  updateItemLayout: (
    dashboardId: string,
    groupId: string,
    itemId: string,
    payload: LayoutPayload,
  ) => boolean;
  updateItemData: (
    dashboardId: string,
    groupId: string,
    itemId: string,
    payload: Partial<
      Pick<DashboardItem, "label" | "refId" | "data" | "minSize" | "type">
    >,
  ) => void;
  deleteItem: (dashboardId: string, groupId: string, itemId: string) => void;
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_ITEM_SIZES: Record<DashboardItemType, { w: number; h: number }> =
  {
    "entity-card": { w: 4, h: 3 },
    "entity-text": { w: 3, h: 2 },
    media: { w: 6, h: 4 },
    button: { w: 2, h: 2 },
    map: { w: 8, h: 6 },
    flow: { w: 6, h: 4 },
  };

const DEFAULT_ITEM_DATA = {
  "entity-card": {},
  "entity-text": {},
  media: {},
  button: {},
  map: {},
  flow: {},
} satisfies Record<DashboardItemType, DashboardItemDataMap[DashboardItemType]>;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const isColliding = (a: DashboardItem, b: DashboardItem) => {
  return (
    a.position.x < b.position.x + b.size.w &&
    a.position.x + a.size.w > b.position.x &&
    a.position.y < b.position.y + b.size.h &&
    a.position.y + a.size.h > b.position.y
  );
};

const clampPosition = (
  group: DashboardGroup,
  size: { w: number; h: number },
  position: { x: number; y: number },
) => {
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, group.cols - size.w)),
    y: Math.min(Math.max(0, position.y), Math.max(0, group.rows - size.h)),
  };
};

const clampSizeToGroup = (
  group: DashboardGroup,
  size: { w: number; h: number },
  minSize: { w: number; h: number },
) => {
  return {
    w: Math.min(group.cols, Math.max(size.w, minSize.w)),
    h: Math.min(group.rows, Math.max(size.h, minSize.h)),
  };
};

const findOpenSlot = (
  group: DashboardGroup,
  size: { w: number; h: number },
): { x: number; y: number } => {
  for (let y = 0; y <= group.rows - size.h; y++) {
    for (let x = 0; x <= group.cols - size.w; x++) {
      const candidate: DashboardItem = {
        id: "preview",
        type: "entity-card",
        position: { x, y },
        size,
        minSize: size,
      };

      const collides = group.items.some((item) => isColliding(candidate, item));
      if (!collides) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: 0 };
};

/** Merges multiple layout groups into one canvas (first group's grid size; items from other groups re-placed). */
const mergeGroupsIntoOne = (groups: DashboardGroup[]): DashboardGroup => {
  if (groups.length === 0) {
    return createDefaultGroup("Main");
  }
  if (groups.length === 1) {
    return groups[0];
  }

  const primary: DashboardGroup = {
    ...groups[0],
    items: groups[0].items.map((item) => ({ ...item })),
  };

  const seenIds = new Set(primary.items.map((i) => i.id));

  for (let gi = 1; gi < groups.length; gi++) {
    for (const item of groups[gi].items) {
      let id = item.id;
      if (seenIds.has(id)) {
        id = createId();
      }
      seenIds.add(id);

      const size = clampSizeToGroup(primary, item.size, item.minSize);
      const position = findOpenSlot(primary, size);
      const clampedPos = clampPosition(primary, size, position);
      const nextItem: DashboardItem = {
        ...item,
        id,
        size,
        position: clampedPos,
      };
      primary.items = [...primary.items, nextItem];
    }
  }

  return primary;
};

const createDefaultGroup = (title: string): DashboardGroup => ({
  id: createId(),
  title,
  cols: 16,
  rows: 12,
  items: [],
});

const createDefaultDashboard = (name: string): DynamicDashboard => ({
  id: createId(),
  name,
  groups: [createDefaultGroup("Main Group")],
});

export const useDynamicDashboardStore = create<DynamicDashboardState>()(
  (set, get) => {
    const scheduleSync = (dashboardId: string, includeName?: boolean) => {
      const dashboard = get().dashboards.find((d) => d.id === dashboardId);
      if (!dashboard) return;

      if (saveTimers.has(dashboardId)) {
        clearTimeout(saveTimers.get(dashboardId));
      }

      const layoutPayload = { groups: dashboard.groups };

      const timer = setTimeout(async () => {
        try {
          await api.updateDashboard(dashboardId, {
            layout: layoutPayload,
            name: includeName ? dashboard.name : undefined,
          });
        } catch (err) {
          console.error("Failed to sync dashboard layout", err);
        }
      }, 500);

      saveTimers.set(dashboardId, timer);
    };

    const isDashboardGroup = (value: unknown): value is DashboardGroup => {
      if (!value || typeof value !== "object") return false;
      const candidate = value as Partial<DashboardGroup>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.title === "string" &&
        typeof candidate.cols === "number" &&
        typeof candidate.rows === "number" &&
        Array.isArray(candidate.items)
      );
    };

    const parseLayoutGroups = (layout: unknown): DashboardGroup[] => {
      if (
        layout &&
        typeof layout === "object" &&
        Array.isArray((layout as { groups?: unknown }).groups)
      ) {
        const rawGroups = (layout as { groups: unknown }).groups as unknown[];
        return rawGroups.filter(isDashboardGroup) as DashboardGroup[];
      }
      return [];
    };

    const mapDtoToDashboard = (
      dto: api.DynamicDashboardDto,
    ): DynamicDashboard => {
      const raw = parseLayoutGroups(dto.layout);
      let groups: DashboardGroup[];
      if (raw.length === 0) {
        groups = [createDefaultGroup("Main")];
      } else if (raw.length === 1) {
        groups = raw;
      } else {
        groups = [mergeGroupsIntoOne(raw)];
      }

      return {
        id: dto.id,
        name: dto.name,
        groups,
      };
    };

    return {
      dashboards: [],
      activeDashboardId: undefined,
      isLoading: false,
      hasLoaded: false,
      error: null,
      loadDashboards: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.listDashboards();
          const dashboards = res.data.map(mapDtoToDashboard);
          set((state) => ({
            dashboards,
            hasLoaded: true,
            isLoading: false,
            activeDashboardId: state.activeDashboardId || dashboards[0]?.id,
          }));
        } catch (err) {
          console.error("Failed to load dashboards", err);
          set({ error: "Failed to load dashboards", isLoading: false, hasLoaded: true });
        }
      },
      createDashboard: async (name) => {
        const newDashboard = createDefaultDashboard(
          name || `Dynamic Dashboard ${get().dashboards.length + 1}`,
        );
        try {
          const res = await api.createDashboard({
            name: newDashboard.name,
            layout: { groups: newDashboard.groups },
          });
          const created = mapDtoToDashboard(res.data);
          set((state) => ({
            dashboards: [...state.dashboards, created],
            activeDashboardId: created.id,
          }));
          return created.id;
        } catch (err) {
          console.error("Failed to create dashboard", err);
          set({ error: "Failed to create dashboard" });
          return null;
        }
      },
      cloneDashboard: async (dashboardId) => {
        const target = get().dashboards.find((d) => d.id === dashboardId);
        if (!target) {
          return null;
        }

        const clonedGroups = target.groups.map((g) => ({
          ...g,
          id: createId(),
          items: g.items.map((i) => ({ ...i, id: createId() })),
        }));

        const merged =
          clonedGroups.length <= 1
            ? clonedGroups[0] ?? createDefaultGroup("Main")
            : mergeGroupsIntoOne(clonedGroups);

        const cloned: DynamicDashboard = {
          ...target,
          id: createId(),
          name: `${target.name} (copy)`,
          groups: [merged],
        };

        try {
          const res = await api.createDashboard({
            name: cloned.name,
            layout: { groups: cloned.groups },
          });
          const created = mapDtoToDashboard(res.data);
          set((state) => ({
            dashboards: [...state.dashboards, created],
            activeDashboardId: created.id,
          }));
          return created.id;
        } catch (err) {
          console.error("Failed to clone dashboard", err);
          set({ error: "Failed to clone dashboard" });
          return null;
        }
      },
      deleteDashboard: async (dashboardId) => {
        try {
          await api.deleteDashboard(dashboardId);
        } catch (err) {
          console.error("Failed to delete dashboard", err);
          set({ error: "Failed to delete dashboard" });
        }

        set((state) => {
          const filtered = state.dashboards.filter((d) => d.id !== dashboardId);
          const activeDashboardId =
            state.activeDashboardId === dashboardId
              ? filtered[0]?.id
              : state.activeDashboardId;
          return { dashboards: filtered, activeDashboardId };
        });
      },
      setActiveDashboard: (dashboardId) => {
        set({ activeDashboardId: dashboardId });
      },
      updateDashboardMeta: (dashboardId, data) => {
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === dashboardId ? { ...d, ...data } : d,
          ),
        }));
        scheduleSync(dashboardId, true);
      },
      addItem: (dashboardId, groupId, payload) => {
        let createdId: string | null = null;

        set((state) => {
          const dashboards = state.dashboards.map((d) => {
            if (d.id !== dashboardId) {
              return d;
            }

            const groups = d.groups.map((g) => {
              if (g.id !== groupId) {
                return g;
              }

              const baseSize =
                payload.size || DEFAULT_ITEM_SIZES[payload.type] || { w: 3, h: 2 };
              const minSize =
                payload.minSize || DEFAULT_ITEM_SIZES[payload.type] || baseSize;
              const size = clampSizeToGroup(g, baseSize, minSize);
              const position = findOpenSlot(g, size);
              const data = payload.data ?? { ...DEFAULT_ITEM_DATA[payload.type] };
              const newItem: DashboardItem = {
                id: createId(),
                type: payload.type,
                label: payload.label,
                refId: payload.refId,
                position,
                size,
                minSize,
                data,
              };

              createdId = newItem.id;
              return { ...g, items: [...g.items, newItem] };
            });

            return { ...d, groups };
          });

          return { ...state, dashboards };
        });
        scheduleSync(dashboardId);

        return createdId;
      },
      updateItemLayout: (dashboardId, groupId, itemId, payload) => {
        let updated = false;

        set((state) => {
          const dashboards = state.dashboards.map((d) => {
            if (d.id !== dashboardId) {
              return d;
            }

            const groups = d.groups.map((g) => {
              if (g.id !== groupId) {
                return g;
              }

              const items = g.items.map((item) => {
                if (item.id !== itemId) {
                  return item;
                }

                const nextSize = payload.size
                  ? clampSizeToGroup(g, payload.size, item.minSize)
                  : item.size;
                const nextPos = clampPosition(
                  g,
                  nextSize,
                  payload.position || item.position,
                );

                const candidate = { ...item, size: nextSize, position: nextPos };
                const collision = g.items.some(
                  (other) => other.id !== itemId && isColliding(candidate, other),
                );

                if (collision) {
                  return item;
                }

                updated = true;
                return candidate;
              });

              return { ...g, items };
            });

            return { ...d, groups };
          });

          return updated ? { ...state, dashboards } : state;
        });

        if (updated) {
          scheduleSync(dashboardId);
        }

        return updated;
      },
      updateItemData: (dashboardId, groupId, itemId, payload) => {
        set((state) => ({
          dashboards: state.dashboards.map((d) => {
            if (d.id !== dashboardId) {
              return d;
            }

            const groups = d.groups.map((g) => {
              if (g.id !== groupId) {
                return g;
              }

              const items = g.items.map((item) =>
                item.id === itemId ? { ...item, ...payload } : item,
              );

              return { ...g, items };
            });

            return { ...d, groups };
          }),
        }));
        scheduleSync(dashboardId);
      },
      deleteItem: (dashboardId, groupId, itemId) => {
        set((state) => ({
          dashboards: state.dashboards.map((d) => {
            if (d.id !== dashboardId) {
              return d;
            }

            const groups = d.groups.map((g) =>
              g.id === groupId
                ? { ...g, items: g.items.filter((item) => item.id !== itemId) }
                : g,
            );

            return { ...d, groups };
          }),
        }));
        scheduleSync(dashboardId);
      },
    };
  },
);
