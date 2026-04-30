import { apiClient } from "@/shared/api";
import { Role, CreateRolePayload, UpdateRolePayload } from "./types";

export const getRoles = () => apiClient.get<Role[]>("/roles");
export const createRole = (data: CreateRolePayload) =>
  apiClient.post<Role>("/roles", data);
export const updateRole = (id: number, data: UpdateRolePayload) =>
  apiClient.put<Role>(`/roles/${id}`, data);
export const deleteRole = (id: number) => apiClient.delete(`/roles/${id}`);
