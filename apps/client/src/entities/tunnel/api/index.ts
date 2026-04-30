import { apiClient } from "@/shared/api";
import type {
  StartTunnelRequest,
  StartTunnelResponse,
  TunnelStatus,
} from "./types";

export const getStatus = () => apiClient.get<TunnelStatus>("/tunnel/status");

export const startTunnel = (payload: StartTunnelRequest) =>
  apiClient.post<StartTunnelResponse>("/tunnel/start", payload);

export const stopTunnel = () => apiClient.post("/tunnel/stop");
