import { apiClient } from "@/shared/api";

import { HaState } from "./types";

export const fetchAllHaStates = async (): Promise<HaState[]> => {
  try {
    const response = await apiClient.get<HaState[]>("/ha/states");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch Home Assistant states:", error);
    throw new Error("Failed to fetch HA states.");
  }
};
