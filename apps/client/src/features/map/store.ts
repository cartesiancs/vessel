import { create } from "zustand";
import type { EntityAll } from "@/entities/entity/types";

interface MapState {
  selectedEntity: EntityAll | null;
  setSelectedEntity: (entity: EntityAll | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedEntity: null,
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
}));
