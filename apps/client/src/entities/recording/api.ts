import { apiClient } from "@/shared/api";
import {
  Recording,
  StartRecordingRequest,
  StartRecordingResponse,
  ActiveRecordingInfo,
  TopicRecordingStatus,
} from "./types";

export const getRecordings = async (): Promise<Recording[]> => {
  const { data } = await apiClient.get<Recording[]>("/recordings");
  return data;
};

export const getRecordingsByTopic = async (
  topic: string
): Promise<Recording[]> => {
  const { data } = await apiClient.get<Recording[]>("/recordings", {
    params: { topic },
  });
  return data;
};

export const getRecordingsByStatus = async (
  status: string
): Promise<Recording[]> => {
  const { data } = await apiClient.get<Recording[]>("/recordings", {
    params: { status },
  });
  return data;
};

export const getRecording = async (id: number): Promise<Recording> => {
  const { data } = await apiClient.get<Recording>(`/recordings/${id}`);
  return data;
};

export const startRecording = async (
  payload: StartRecordingRequest
): Promise<StartRecordingResponse> => {
  const { data } = await apiClient.post<StartRecordingResponse>(
    "/recordings",
    payload
  );
  return data;
};

export const stopRecording = async (id: number): Promise<void> => {
  await apiClient.post(`/recordings/${id}/stop`);
};

export const deleteRecording = async (id: number): Promise<void> => {
  await apiClient.delete(`/recordings/${id}`);
};

export const getActiveRecordings = async (): Promise<ActiveRecordingInfo[]> => {
  const { data } = await apiClient.get<ActiveRecordingInfo[]>(
    "/recordings/active"
  );
  return data;
};

export const isTopicRecording = async (
  topic: string
): Promise<TopicRecordingStatus> => {
  const encodedTopic = encodeURIComponent(topic);
  const { data } = await apiClient.get<TopicRecordingStatus>(
    `/recordings/active/${encodedTopic}`
  );
  return data;
};

export const getRecordingStreamUrl = (
  id: number,
  serverUrl: string,
  token: string
): string => {
  return `${serverUrl}/api/recordings/${id}/stream?token=${token}`;
};
