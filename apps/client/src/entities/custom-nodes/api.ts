import { apiClient } from "@/shared/api";
import { CustomNodeFromApi } from "./types";

export const getAllCustomNodes = async (): Promise<CustomNodeFromApi[]> => {
  const response = await apiClient.get("/custom-nodes");
  return response.data;
};

export const createCustomNode = async (node: {
  node_type: string;
  data: string;
}): Promise<CustomNodeFromApi> => {
  const response = await apiClient.post("/custom-nodes", node);
  return response.data;
};

export const updateCustomNode = async (
  node_type: string,
  data: string,
): Promise<CustomNodeFromApi> => {
  const response = await apiClient.put(`/custom-nodes/${node_type}`, { data });
  return response.data;
};

export const deleteCustomNode = async (node_type: string): Promise<void> => {
  await apiClient.delete(`/custom-nodes/${node_type}`);
};
