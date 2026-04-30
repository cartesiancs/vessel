import { apiClient } from "@/shared/api";
import type { DeviceToken, IssuedTokenResponse } from "./types";

export const issueDeviceToken = (deviceId: number) =>
  apiClient.post<IssuedTokenResponse>(`/devices/${deviceId}/token`);

export const getDeviceTokenInfo = (deviceId: number) =>
  apiClient.get<DeviceToken | { message: string }>(
    `/devices/${deviceId}/token`,
  );

export const revokeDeviceToken = (deviceId: number) =>
  apiClient.delete(`/devices/${deviceId}/token`);
