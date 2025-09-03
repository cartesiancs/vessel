import { create } from "zustand";
import { HaStateStore } from "./types";
import { fetchAllHaStates } from "./api";

export const useHaStore = create<HaStateStore>((set) => ({
  states: [],
  status: "idle",
  error: null,

  fetchStates: async () => {
    set({ status: "loading", error: null });
    try {
      const data = await fetchAllHaStates();
      set({ states: data, status: "succeeded" });
    } catch (error) {
      set({
        status: "failed",
        error: "Failed to load states from server." + error,
      });
    }
  },
}));
