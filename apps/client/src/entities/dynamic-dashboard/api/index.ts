import { apiClient } from "@/shared/api";

export type DynamicDashboardDto = {
  id: string;
  name: string;
  layout: unknown;
  created_at: string;
  updated_at: string;
};

export const listDashboards = () =>
  apiClient.get<DynamicDashboardDto[]>("/dynamic-dashboards");

export const getDashboard = (id: string) =>
  apiClient.get<DynamicDashboardDto>(`/dynamic-dashboards/${id}`);

export const createDashboard = (payload: {
  name: string;
  layout: unknown;
}) => apiClient.post<DynamicDashboardDto>("/dynamic-dashboards", payload);

export const updateDashboard = (
  id: string,
  payload: { name?: string; layout?: unknown },
) => apiClient.put<DynamicDashboardDto>(`/dynamic-dashboards/${id}`, payload);

export const deleteDashboard = (id: string) =>
  apiClient.delete(`/dynamic-dashboards/${id}`);
