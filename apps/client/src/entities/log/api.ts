import { apiClient } from "@/shared/api";
import { LogContentResponse, LogFileListResponse } from "./types";

export const getLatestLog = async (): Promise<LogContentResponse> => {
  const { data } = await apiClient.get<LogContentResponse>("/logs/latest");
  return data;
};

export const getLogFileList = async (): Promise<LogFileListResponse> => {
  const { data } = await apiClient.get<LogFileListResponse>("/logs");
  return data;
};

export const getLogByFilename = async (
  filename: string,
): Promise<LogContentResponse> => {
  const { data } = await apiClient.get<LogContentResponse>(`/logs/${filename}`);
  return data;
};
