import { apiClient } from "@/shared/api";
import type { Entity, EntityPayload } from "./types";

export const getEntities = () => apiClient.get<Entity[]>("/entities");

export const createEntity = (data: EntityPayload) =>
  apiClient.post<Entity>("/entities", data);

export const updateEntity = (id: number, data: EntityPayload) =>
  apiClient.put<Entity>(`/entities/${id}`, data);

export const deleteEntity = (id: number) => apiClient.delete(`/entities/${id}`);
