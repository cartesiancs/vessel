import { apiClient } from "@/shared/api";
import { Stat } from "../model/types";

export const getStats = async (): Promise<Stat> => {
  const { data } = await apiClient.get<Stat>("/stat");
  return data;
};
