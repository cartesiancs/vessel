import { apiClient } from "@/shared/api";
import type { Entity, EntityAll, EntityPayload } from "./types";

export const getEntities = () => apiClient.get<Entity[]>("/entities");
export const getAllEntities = () => apiClient.get<EntityAll[]>("/entities/all");
export const getEntitiesFilter = (entityType?: string) => {
  return apiClient.get<Entity[]>("/entities", {
    params: {
      entity_type: entityType,
    },
  });
};
export const getAllEntitiesFilter = (entityType?: string) => {
  return apiClient.get<EntityAll[]>("/entities/all", {
    params: {
      entity_type: entityType,
    },
  });
};

export const createEntity = (data: EntityPayload) =>
  apiClient.post<Entity>("/entities", data);

export const updateEntity = (id: number, data: EntityPayload) =>
  apiClient.put<Entity>(`/entities/${id}`, data);

export const deleteEntity = (id: number) => apiClient.delete(`/entities/${id}`);
