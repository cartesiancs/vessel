import { create } from "zustand";
import * as api from "./api";
import type { Device, DevicePayload } from "./types";

interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  isLoading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
  createDevice: (data: DevicePayload) => Promise<void>;
  updateDevice: (id: number, data: DevicePayload) => Promise<void>;
  deleteDevice: (id: number) => Promise<void>;
  selectDevice: (device: Device | null) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedDevice: null,
  isLoading: false,
  error: null,
  selectDevice: (device) => set({ selectedDevice: device }),
  fetchDevices: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getDevices();
      set({ devices: response.data, isLoading: false });
    } catch (err) {
      set({ error: "Failed to fetch devices", isLoading: false });
      console.error(err);
    }
  },
  createDevice: async (data) => {
    await api.createDevice(data);
    await get().fetchDevices();
  },
  updateDevice: async (id, data) => {
    await api.updateDevice(id, data);
    await get().fetchDevices();
  },
  deleteDevice: async (id) => {
    await api.deleteDevice(id);
    if (get().selectedDevice?.id === id) {
      set({ selectedDevice: null });
    }
    await get().fetchDevices();
  },
}));
