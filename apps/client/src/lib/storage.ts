const LEGACY_TOKEN_KEY = "vessel_token";
const LEGACY_SERVER_URL_KEY = "vessel_server_url";
const SERVERS_KEY = "vessel_servers";
const RECENT_URLS_KEY = "vessel_recent_server_urls";
const CAPSULE_URL_KEY = "vessel_capsule_url";

export type ServerConnection = {
  id: string;
  url: string;
  token: string;
  name?: string;
};

type ServersBlob = {
  servers: ServerConnection[];
  activeId: string | null;
};

type ServersListener = () => void;
const listeners = new Set<ServersListener>();

function emit() {
  listeners.forEach((l) => l());
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `srv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseBlob(raw: string | null): ServersBlob {
  if (!raw) return { servers: [], activeId: null };
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.servers) &&
      (typeof parsed.activeId === "string" || parsed.activeId === null)
    ) {
      return parsed as ServersBlob;
    }
  } catch {
    // fall through
  }
  return { servers: [], activeId: null };
}

let cachedBlob: ServersBlob = { servers: [], activeId: null };

function readBlob(): ServersBlob {
  return cachedBlob;
}

function writeBlob(blob: ServersBlob): void {
  cachedBlob = blob;
  localStorage.setItem(SERVERS_KEY, JSON.stringify(blob));
  emit();
}

function getActive(blob: ServersBlob): ServerConnection | null {
  if (!blob.activeId) return null;
  return blob.servers.find((s) => s.id === blob.activeId) ?? null;
}

function migrateLegacyIfNeeded(): void {
  if (localStorage.getItem(SERVERS_KEY)) return;
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  const legacyUrl = localStorage.getItem(LEGACY_SERVER_URL_KEY);
  if (legacyToken && legacyUrl) {
    const id = generateId();
    const blob: ServersBlob = {
      servers: [{ id, url: legacyUrl, token: legacyToken }],
      activeId: id,
    };
    localStorage.setItem(SERVERS_KEY, JSON.stringify(blob));
  }
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_SERVER_URL_KEY);
}

if (typeof window !== "undefined") {
  try {
    migrateLegacyIfNeeded();
    cachedBlob = parseBlob(localStorage.getItem(SERVERS_KEY));
    window.addEventListener("storage", (e) => {
      if (e.key !== SERVERS_KEY) return;
      cachedBlob = parseBlob(e.newValue);
      emit();
    });
  } catch {
    // best effort
  }
}

export const storage = {
  // ---------- multi-server API ----------
  getServers: (): ServerConnection[] => readBlob().servers,

  getActiveServer: (): ServerConnection | null => getActive(readBlob()),

  setActiveServer: (id: string): void => {
    const blob = readBlob();
    if (!blob.servers.some((s) => s.id === id)) return;
    writeBlob({ ...blob, activeId: id });
  },

  addServer: (input: { url: string; token: string; name?: string }): string => {
    const blob = readBlob();
    const existing = blob.servers.find((s) => s.url === input.url);
    if (existing) {
      const updated = { ...existing, token: input.token, name: input.name ?? existing.name };
      const servers = blob.servers.map((s) => (s.id === existing.id ? updated : s));
      writeBlob({ servers, activeId: existing.id });
      return existing.id;
    }
    const id = generateId();
    const next: ServerConnection = { id, url: input.url, token: input.token, name: input.name };
    writeBlob({ servers: [...blob.servers, next], activeId: id });
    return id;
  },

  removeServer: (id: string): void => {
    const blob = readBlob();
    const servers = blob.servers.filter((s) => s.id !== id);
    let activeId = blob.activeId;
    if (activeId === id) {
      activeId = servers[0]?.id ?? null;
    }
    writeBlob({ servers, activeId });
  },

  updateServerToken: (id: string, token: string): void => {
    const blob = readBlob();
    const servers = blob.servers.map((s) => (s.id === id ? { ...s, token } : s));
    writeBlob({ ...blob, servers });
  },

  updateServerName: (id: string, name: string): void => {
    const blob = readBlob();
    const servers = blob.servers.map((s) => (s.id === id ? { ...s, name } : s));
    writeBlob({ ...blob, servers });
  },

  subscribeServers: (listener: ServersListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // ---------- legacy single-server API (routes through active server) ----------
  getToken: (): string | null => getActive(readBlob())?.token ?? null,

  setToken: (token: string): void => {
    const blob = readBlob();
    const active = getActive(blob);
    if (!active) return;
    const servers = blob.servers.map((s) => (s.id === active.id ? { ...s, token } : s));
    writeBlob({ ...blob, servers });
  },

  removeToken: (): void => {
    const blob = readBlob();
    const active = getActive(blob);
    if (!active) return;
    const servers = blob.servers.map((s) => (s.id === active.id ? { ...s, token: "" } : s));
    writeBlob({ ...blob, servers });
  },

  getServerUrl: (): string | null => getActive(readBlob())?.url ?? null,

  setServerUrl: (url: string): void => {
    const blob = readBlob();
    const active = getActive(blob);
    if (active) {
      const servers = blob.servers.map((s) => (s.id === active.id ? { ...s, url } : s));
      writeBlob({ ...blob, servers });
      return;
    }
    const id = generateId();
    writeBlob({
      servers: [...blob.servers, { id, url, token: "" }],
      activeId: id,
    });
  },

  removeServerUrl: (): void => {
    const blob = readBlob();
    if (!blob.activeId) return;
    storage.removeServer(blob.activeId);
  },

  // ---------- recent URLs (login history; unchanged) ----------
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

  // ---------- capsule URL (LLM chat; unrelated to server URL) ----------
  getCapsuleUrl: (): string | null => {
    return localStorage.getItem(CAPSULE_URL_KEY);
  },

  setCapsuleUrl: (url: string): void => {
    localStorage.setItem(CAPSULE_URL_KEY, url);
  },

  removeCapsuleUrl: (): void => {
    localStorage.removeItem(CAPSULE_URL_KEY);
  },

  clearAll: (): void => {
    localStorage.removeItem(SERVERS_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_SERVER_URL_KEY);
    localStorage.removeItem(CAPSULE_URL_KEY);
    emit();
  },
};
