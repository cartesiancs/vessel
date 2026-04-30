import { create } from "zustand";
import * as api from "./api";
import type { Stat } from "./types";

interface StatState {
  stat: Stat;
  isLoading: boolean;
  error: string | null;
  fetchStat: () => Promise<void>;
}

export const useStatStore = create<StatState>((set) => ({
  stat: {
    count: {
      devices: 0,
      entities: 0,
    },
  },
  isLoading: false,
  error: null,
  fetchStat: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getStats();
      set({ stat: response, isLoading: false });
    } catch (err) {
      set({ error: "Failed to fetch entities" + err, isLoading: false });
    }
  },
}));
