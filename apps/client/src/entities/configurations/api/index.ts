import { apiClient } from "@/shared/api";
import type { SystemConfiguration, SystemConfigurationPayload } from "./types";

export const getConfigs = () =>
  apiClient.get<SystemConfiguration[]>("/configurations");

export const createConfig = (data: SystemConfigurationPayload) =>
  apiClient.post<SystemConfiguration>("/configurations", data);

export const updateConfig = (id: number, data: SystemConfigurationPayload) =>
  apiClient.put<SystemConfiguration>(`/configurations/${id}`, data);

export const deleteConfig = (id: number) =>
  apiClient.delete(`/configurations/${id}`);
