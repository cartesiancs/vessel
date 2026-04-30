import { create } from "zustand";
import * as api from "./api";
import type { DeviceToken } from "./types";

interface DeviceTokenState {
  tokenInfo: DeviceToken | null;
  newToken: string | null;
  isLoading: boolean;
  error: string | null;
  fetchTokenInfo: (deviceId: number) => Promise<void>;
  issueToken: (deviceId: number) => Promise<void>;
  revokeToken: (deviceId: number) => Promise<void>;
  clearNewToken: () => void;
}

export const useDeviceTokenStore = create<DeviceTokenState>((set, get) => ({
  tokenInfo: null,
  newToken: null,
  isLoading: false,
  error: null,

  fetchTokenInfo: async (deviceId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getDeviceTokenInfo(deviceId);
      if (response.data && "id" in response.data) {
        set({ tokenInfo: response.data, isLoading: false });
      } else {
        set({ tokenInfo: null, isLoading: false });
      }
    } catch (err) {
      console.error("Failed to fetch token info:", err);
      set({ tokenInfo: null, isLoading: false });
    }
  },
  issueToken: async (deviceId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.issueDeviceToken(deviceId);
      set({ newToken: response.data.token, isLoading: false });
      await get().fetchTokenInfo(deviceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ error: "Failed to issue token: " + errorMsg, isLoading: false });
    }
  },
  revokeToken: async (deviceId) => {
    set({ isLoading: true, error: null });
    try {
      await api.revokeDeviceToken(deviceId);
      set({ tokenInfo: null, isLoading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      set({ error: "Failed to revoke token: " + errorMsg, isLoading: false });
    }
  },
  clearNewToken: () => {
    set({ newToken: null });
  },
}));
