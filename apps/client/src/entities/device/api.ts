import { apiClient } from "@/shared/api";
import type { Device, DevicePayload, DeviceWithEntity } from "./types";

export const getDevices = () => apiClient.get<Device[]>("/devices");
export const getDeviceById = (pk_id: number) =>
  apiClient.get<DeviceWithEntity>("/devices/id/" + pk_id);

export const createDevice = (data: DevicePayload) =>
  apiClient.post<Device>("/devices", data);
export const updateDevice = (id: number, data: DevicePayload) =>
  apiClient.put<Device>(`/devices/${id}`, data);
export const deleteDevice = (id: number) => apiClient.delete(`/devices/${id}`);
