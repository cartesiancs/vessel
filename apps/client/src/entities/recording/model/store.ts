import { create } from "zustand";
import * as api from "../api";
import type { Recording, ActiveRecordingInfo } from "./types";

interface RecordingState {
  recordings: Recording[];
  activeRecordings: ActiveRecordingInfo[];
  isLoading: boolean;
  error: string | null;
  fetchRecordings: () => Promise<void>;
  fetchActiveRecordings: () => Promise<void>;
  startRecording: (topic: string) => Promise<number>;
  stopRecording: (id: number) => Promise<void>;
  deleteRecording: (id: number) => Promise<void>;
  isRecording: (topic: string) => boolean;
  getActiveRecordingId: (topic: string) => number | null;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  recordings: [],
  activeRecordings: [],
  isLoading: false,
  error: null,

  fetchRecordings: async () => {
    set({ isLoading: true, error: null });
    try {
      const recordings = await api.getRecordings();
      set({ recordings, isLoading: false });
    } catch (err) {
      set({ error: "Failed to fetch recordings", isLoading: false });
      console.error(err);
    }
  },

  fetchActiveRecordings: async () => {
    try {
      const activeRecordings = await api.getActiveRecordings();
      set({ activeRecordings });
    } catch (err) {
      console.error("Failed to fetch active recordings", err);
    }
  },

  startRecording: async (topic: string) => {
    try {
      const response = await api.startRecording({ topic });
      await get().fetchActiveRecordings();
      await get().fetchRecordings();
      return response.id;
    } catch (err) {
      console.error("Failed to start recording", err);
      throw err;
    }
  },

  stopRecording: async (id: number) => {
    try {
      await api.stopRecording(id);
      await get().fetchActiveRecordings();
      // Wait a bit for the recording to be finalized
      setTimeout(() => get().fetchRecordings(), 1000);
    } catch (err) {
      console.error("Failed to stop recording", err);
      throw err;
    }
  },

  deleteRecording: async (id: number) => {
    try {
      await api.deleteRecording(id);
      await get().fetchRecordings();
    } catch (err) {
      console.error("Failed to delete recording", err);
      throw err;
    }
  },

  isRecording: (topic: string) => {
    return get().activeRecordings.some((r) => r.topic === topic);
  },

  getActiveRecordingId: (topic: string) => {
    const active = get().activeRecordings.find((r) => r.topic === topic);
    return active?.recording_id ?? null;
  },
}));
