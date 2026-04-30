import { create } from "zustand";
import * as api from "../api";

interface IntegrationState {
  isHaConnected: boolean;
  isRos2Connected: boolean;
  isSdrConnected: boolean;
  isLoading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  registerIntegration: (
    id: string,
    config: Record<string, string>,
  ) => Promise<void>;
  deleteIntegration: (id: string) => Promise<void>;
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  isHaConnected: false,
  isRos2Connected: false,
  isSdrConnected: false,
  isLoading: false,
  error: null,
  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getIntegrationStatus();
      set({
        isHaConnected: response.data.home_assistant.connected,
        isRos2Connected: response.data.ros2.connected,
        isSdrConnected: response.data.sdr.connected,
        isLoading: false,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({
        error: "Failed to fetch integration status: " + errorMsg,
        isLoading: false,
      });
    }
  },
  registerIntegration: async (id, config) => {
    await api.registerIntegration({ integration_id: id, config });
    await get().fetchStatus();
  },
  deleteIntegration: async (id) => {
    await api.deleteIntegration(id);
    await get().fetchStatus();
  },
}));
