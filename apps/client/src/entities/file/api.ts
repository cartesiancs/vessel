import { DirEntry } from "./types";
import { apiClient } from "@/shared/api";

export const getDirectoryListing = async (
  path: string,
): Promise<DirEntry[]> => {
  const response = await apiClient.get(`/storage/${path}`);

  const entries: { path: string; entries: { name: string; isDir: boolean }[] } =
    response.data;

  return entries.entries.map((entry) => ({
    ...entry,
    path: path ? `${path}/${entry.name}` : entry.name,
  }));
};

export const getFileContent = async (path: string): Promise<string> => {
  const response = await apiClient.get(`/storage/${path}`);
  return response.data;
};

export const updateFileContent = async (
  path: string,
  content: string,
): Promise<void> => {
  await apiClient.put(`/storage/${path}`, { content });
};
