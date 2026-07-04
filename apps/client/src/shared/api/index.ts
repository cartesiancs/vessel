import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { isDemoMode } from "../config/demo";
import { createMockAdapter } from "../mock/mockAdapter";
import { storage } from "@/shared/lib/storage";
import { refreshActiveSession } from "@/shared/lib/session";

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

if (isDemoMode) {
  apiClient.defaults.adapter = createMockAdapter();
}

apiClient.interceptors.request.use(
  (config) => {
    if (!isDemoMode) {
      const token = storage.getToken();
      const serverUrl = storage.getServerUrl();

      if (serverUrl) {
        config.baseURL = `${serverUrl}/api`;
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    if (
      isDemoMode ||
      !error.response ||
      error.response.status !== 401 ||
      !original ||
      original._retry
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    const newToken = await refreshActiveSession();
    if (newToken) {
      // The request interceptor re-reads the token from storage, so the
      // replayed request picks up the freshly rotated access token.
      return apiClient(original);
    }

    storage.removeToken();
    window.location.href = "/auth";
    return Promise.reject(error);
  },
);
