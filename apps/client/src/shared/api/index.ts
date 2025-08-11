import axios from "axios";
import Cookies from "js-cookie";

export const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token");
    const serverUrl = Cookies.get("server_url");

    if (serverUrl) {
      config.baseURL = `${serverUrl}/api`;
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);
