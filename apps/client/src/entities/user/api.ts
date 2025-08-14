import { apiClient } from "@/shared/api";
import { User, CreateUserPayload, UpdateUserPayload } from "./types";

export const getUsers = () => apiClient.get<User[]>("/users");
export const createUser = (data: CreateUserPayload) =>
  apiClient.post<User>("/users", data);
export const updateUser = (id: number, data: UpdateUserPayload) =>
  apiClient.put<User>(`/users/${id}`, data);
export const deleteUser = (id: number) => apiClient.delete(`/users/${id}`);
