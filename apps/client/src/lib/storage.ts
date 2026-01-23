const TOKEN_KEY = "vessel_token";
const SERVER_URL_KEY = "vessel_server_url";
const RECENT_URLS_KEY = "vessel_recent_server_urls";

export const storage = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },

  getServerUrl: (): string | null => {
    return localStorage.getItem(SERVER_URL_KEY);
  },

  setServerUrl: (url: string): void => {
    localStorage.setItem(SERVER_URL_KEY, url);
  },

  removeServerUrl: (): void => {
    localStorage.removeItem(SERVER_URL_KEY);
  },

  getRecentUrls: (): string[] => {
    const stored = localStorage.getItem(RECENT_URLS_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  setRecentUrls: (urls: string[]): void => {
    localStorage.setItem(RECENT_URLS_KEY, JSON.stringify(urls));
  },

  removeRecentUrls: (): void => {
    localStorage.removeItem(RECENT_URLS_KEY);
  },

  clearAll: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SERVER_URL_KEY);
  },
};
