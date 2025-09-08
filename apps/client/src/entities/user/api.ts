import { apiClient } from "@/shared/api";
import { User, CreateUserPayload, UpdateUserPayload } from "./types";

export const getUsers = () => apiClient.get<User[]>("/users");
export const createUser = (data: CreateUserPayload) =>
  apiClient.post<User>("/users", data);
export const updateUser = (id: number, data: UpdateUserPayload) =>
  apiClient.put<User>(`/users/${id}`, data);
export const deleteUser = (id: number) => apiClient.delete(`/users/${id}`);

export const assignRoleToUser = (userId: number, roleId: number) =>
  apiClient.post(`/users/${userId}/roles`, { role_id: roleId });

export const revokeRoleFromUser = (userId: number, roleId: number) =>
  apiClient.delete(`/users/${userId}/roles/${roleId}`);
