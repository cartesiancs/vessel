import { apiClient } from "@/shared/api";
import { Logs } from "./types";

export const getLogs = async (): Promise<Logs> => {
  const { data } = await apiClient.get<Logs>("/logs");
  return data;
};
