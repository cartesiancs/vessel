import { apiClient } from "@/shared/api";
import { Stat } from "./types";

export const getStats = async (): Promise<Stat> => {
  const { data } = await apiClient.get<Stat>("/stat");
  return data;
};
