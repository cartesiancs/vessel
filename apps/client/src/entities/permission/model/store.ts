import { create } from "zustand";
import { getPermissions } from "./api";
import { Permission } from "./types";

type PermissionState = {
  permissions: Permission[];
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
  fetchPermissions: () => Promise<void>;
};

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: [],
  isLoading: false,
  error: null,
  hasFetched: false,
  fetchPermissions: async () => {
    if (get().hasFetched || get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const response = await getPermissions();
      set({
        permissions: response.data,
        isLoading: false,
        hasFetched: true,
      });
    } catch (error) {
      set({ error: "Failed to fetch permissions.", isLoading: false });
      console.error(error);
    }
  },
}));
