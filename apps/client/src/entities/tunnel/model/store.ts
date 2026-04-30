import { create } from "zustand";
import * as api from "../api";
import type { TunnelStatus } from "./types";

type TunnelState = {
  status: TunnelStatus;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  start: (server: string, target: string, accessToken?: string) => Promise<void>;
  stop: () => Promise<void>;
};

const emptyStatus: TunnelStatus = {
  active: false,
  session_id: null,
  server: null,
  target: null,
};

export const useTunnelStore = create<TunnelState>((set, get) => ({
  status: emptyStatus,
  isLoading: false,
  error: null,
  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.getStatus();
      set({ status: res.data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false, status: emptyStatus });
    }
  },
  start: async (server, target, accessToken) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.startTunnel({ server, target, access_token: accessToken });
      set({
        status: {
          active: true,
          session_id: res.data.session_id,
          server,
          target,
        },
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
      throw err;
    }
  },
  stop: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.stopTunnel();
      set({ status: emptyStatus, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
      throw err;
    }
  },
}));
