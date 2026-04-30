import { create } from "zustand";
import * as api from "./api";
import type { SystemConfiguration, SystemConfigurationPayload } from "./types";

interface ConfigState {
  configurations: SystemConfiguration[];
  isLoading: boolean;
  error: string | null;
  fetchConfigs: () => Promise<void>;
  createConfig: (data: SystemConfigurationPayload) => Promise<void>;
  updateConfig: (id: number, data: SystemConfigurationPayload) => Promise<void>;
  deleteConfig: (id: number) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  configurations: [],
  isLoading: false,
  error: null,
  fetchConfigs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getConfigs();
      set({ configurations: response.data, isLoading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({
        error: "Failed to fetch configurations: " + errorMsg,
        isLoading: false,
      });
    }
  },
  createConfig: async (data) => {
    await api.createConfig(data);
    await get().fetchConfigs();
  },
  updateConfig: async (id, data) => {
    await api.updateConfig(id, data);
    await get().fetchConfigs();
  },
  deleteConfig: async (id) => {
    await api.deleteConfig(id);
    await get().fetchConfigs();
  },
}));
