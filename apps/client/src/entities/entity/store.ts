import { create } from "zustand";
import * as api from "./api";
import type { Entity, EntityPayload } from "./types";

interface EntityState {
  entities: Entity[];
  isLoading: boolean;
  error: string | null;
  fetchEntities: () => Promise<void>;
  createEntity: (data: EntityPayload) => Promise<void>;
  updateEntity: (id: number, data: EntityPayload) => Promise<void>;
  deleteEntity: (id: number) => Promise<void>;
}

export const useEntityStore = create<EntityState>((set, get) => ({
  entities: [],
  isLoading: false,
  error: null,
  fetchEntities: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getEntities();
      set({ entities: response.data, isLoading: false });
    } catch (err) {
      set({ error: "Failed to fetch entities" + err, isLoading: false });
    }
  },
  createEntity: async (data) => {
    await api.createEntity(data);
    await get().fetchEntities();
  },
  updateEntity: async (id, data) => {
    await api.updateEntity(id, data);
    await get().fetchEntities();
  },
  deleteEntity: async (id) => {
    await api.deleteEntity(id);
    await get().fetchEntities();
  },
}));
