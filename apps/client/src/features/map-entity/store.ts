import { create } from "zustand";
import type { EntityAll } from "@/entities/entity/types";

interface MapEntityState {
  selectedEntity: EntityAll | null;
  setSelectedEntity: (entity: EntityAll | null) => void;
}

export const useMapEntityStore = create<MapEntityState>((set) => ({
  selectedEntity: null,
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
}));
