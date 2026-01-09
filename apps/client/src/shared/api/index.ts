import axios from "axios";
import Cookies from "js-cookie";
import { isDemoMode } from "../demo";
import { createMockAdapter } from "../mock/mockAdapter";

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
      const token = Cookies.get("token");
      const serverUrl = Cookies.get("server_url");

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
  (error) => {
    if (!isDemoMode && error.response && error.response.status === 401) {
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  },
);
