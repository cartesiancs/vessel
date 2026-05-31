import { apiClient } from "@/shared/api";

export const setFrequency = (frequency: number) =>
  apiClient.post("/sdr/frequency", { frequency });

export const getSamplerate = () =>
  apiClient.get<{ samplerate: number | null }>("/sdr/samplerate");

export const startStream = () => apiClient.post("/sdr/start");

export const stopStream = () => apiClient.post("/sdr/stop");
