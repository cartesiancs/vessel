import { supabase } from "@/lib/supabase";
import { getConfigs, updateConfig } from "@/entities/configurations/api";

export interface TurnCredentialsResponse {
  iceServers: RTCIceServer[];
  expiresAt: string;
  usage: {
    egressBytes: number;
    ingressBytes: number;
    periodStart: string;
    periodEnd: string;
  };
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const TURN_CACHE_KEY = "vessel_turn_credentials";
const RENEWAL_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

interface CachedCredentials {
  iceServers: RTCIceServer[];
  expiresAt: string;
}

/* ── Credential change pub/sub ── */

type CredentialChangeCallback = (iceServers: RTCIceServer[]) => void;
const listeners = new Set<CredentialChangeCallback>();

export function onCredentialChange(cb: CredentialChangeCallback): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function notifyListeners(iceServers: RTCIceServer[]): void {
  listeners.forEach((cb) => cb(iceServers));
}

/* ── Auto-renewal scheduler ── */

let renewalTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRenewal(expiresAt: string): void {
  stopAutoRenewal();
  const delay = Math.max(
    new Date(expiresAt).getTime() - Date.now() - RENEWAL_BUFFER_MS,
    0,
  );

  renewalTimer = setTimeout(async () => {
    try {
      // Try Supabase edge function first (requires Supabase session)
      const result = await fetchTurnCredentials();
      await saveTurnConfigToServer({
        iceServers: result.iceServers,
        expiresAt: result.expiresAt,
      });
      scheduleRenewal(result.expiresAt);
      notifyListeners(result.iceServers);
    } catch {
      // Fallback: load from server DB (another session may have renewed)
      try {
        const serverConfig = await loadTurnConfigFromServer();
        if (serverConfig) {
          cacheCredentials({
            iceServers: serverConfig.iceServers,
            expiresAt: serverConfig.expiresAt,
            usage: { egressBytes: 0, ingressBytes: 0, periodStart: "", periodEnd: "" },
          });
          scheduleRenewal(serverConfig.expiresAt);
          notifyListeners(serverConfig.iceServers);
        } else {
          console.warn("TURN credential auto-renewal failed: no valid credentials available");
        }
      } catch (err) {
        console.warn("TURN credential auto-renewal failed:", err);
      }
    }
  }, delay);
}

export function stopAutoRenewal(): void {
  if (renewalTimer) {
    clearTimeout(renewalTimer);
    renewalTimer = null;
  }
}

/* ── Cache helpers ── */

function getCachedCredentials(): CachedCredentials | null {
  try {
    const stored = localStorage.getItem(TURN_CACHE_KEY);
    if (!stored) return null;

    const cached: CachedCredentials = JSON.parse(stored);
    const expiresAt = new Date(cached.expiresAt).getTime();
    const now = Date.now();

    if (expiresAt - RENEWAL_BUFFER_MS > now) {
      return cached;
    }

    localStorage.removeItem(TURN_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function cacheCredentials(data: TurnCredentialsResponse): void {
  try {
    const cached: CachedCredentials = {
      iceServers: data.iceServers,
      expiresAt: data.expiresAt,
    };
    localStorage.setItem(TURN_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // localStorage unavailable
  }
}

/* ── Server DB helpers ── */

const TURN_CONFIG_KEY = "turn_server_config";

async function loadTurnConfigFromServer(): Promise<CachedCredentials | null> {
  try {
    const response = await getConfigs();
    const entry = response.data.find((c) => c.key === TURN_CONFIG_KEY);
    if (!entry) return null;

    const parsed = JSON.parse(entry.value);
    if (!parsed.iceServers?.length || !parsed.expiresAt) return null;

    const expiresAt = new Date(parsed.expiresAt).getTime();
    if (expiresAt - RENEWAL_BUFFER_MS <= Date.now()) return null;

    return { iceServers: parsed.iceServers, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export async function saveTurnConfigToServer(
  data: CachedCredentials,
): Promise<void> {
  try {
    const response = await getConfigs();
    const entry = response.data.find((c) => c.key === TURN_CONFIG_KEY);
    if (!entry) return;

    await updateConfig(entry.id, {
      key: TURN_CONFIG_KEY,
      value: JSON.stringify({
        iceServers: data.iceServers,
        expiresAt: data.expiresAt,
      }),
      enabled: 1,
      description: entry.description,
    });
  } catch (err) {
    console.warn("Failed to save TURN config to server:", err);
  }
}

/* ── Public API ── */

/** Synchronously read cached TURN iceServers, fallback to STUN */
export function getIceServers(): RTCIceServer[] {
  const cached = getCachedCredentials();
  return cached ? cached.iceServers : DEFAULT_ICE_SERVERS;
}

/** Get current credential info (including expired) for UI display */
export function getCredentialInfo(): {
  iceServers: RTCIceServer[];
  expiresAt: string;
  isExpired: boolean;
} | null {
  try {
    const stored = localStorage.getItem(TURN_CACHE_KEY);
    if (!stored) return null;

    const cached: CachedCredentials = JSON.parse(stored);
    if (!cached.iceServers?.length || !cached.expiresAt) return null;

    const isExpired =
      new Date(cached.expiresAt).getTime() - RENEWAL_BUFFER_MS <= Date.now();
    return {
      iceServers: cached.iceServers,
      expiresAt: cached.expiresAt,
      isExpired,
    };
  } catch {
    return null;
  }
}

/** Ensure valid TURN credentials are available (async fetch if needed) */
export async function ensureIceServers(): Promise<RTCIceServer[]> {
  // 1. Check localStorage cache
  const cached = getCachedCredentials();
  if (cached) {
    scheduleRenewal(cached.expiresAt);
    return cached.iceServers;
  }

  // 2. Load from server DB
  const serverConfig = await loadTurnConfigFromServer();
  if (serverConfig) {
    cacheCredentials({
      iceServers: serverConfig.iceServers,
      expiresAt: serverConfig.expiresAt,
      usage: { egressBytes: 0, ingressBytes: 0, periodStart: "", periodEnd: "" },
    });
    scheduleRenewal(serverConfig.expiresAt);
    return serverConfig.iceServers;
  }

  // 3. Fetch from Supabase edge function + save to server DB
  try {
    const result = await fetchTurnCredentials();
    await saveTurnConfigToServer({
      iceServers: result.iceServers,
      expiresAt: result.expiresAt,
    });
    scheduleRenewal(result.expiresAt);
    return result.iceServers;
  } catch (err) {
    console.warn("Failed to fetch TURN credentials, falling back to STUN:", err);
    return DEFAULT_ICE_SERVERS;
  }
}

/** Fetch fresh TURN credentials from edge function */
export async function fetchTurnCredentials(): Promise<TurnCredentialsResponse> {
  const { data, error } = await supabase.functions.invoke("turn-ice", {
    body: { strip_port_53: true },
  });

  if (error) {
    throw new Error(error.message ?? "Failed to fetch TURN credentials");
  }

  if (!data?.iceServers) {
    throw new Error(data?.error ?? "No iceServers in response");
  }

  const response: TurnCredentialsResponse = {
    iceServers: data.iceServers,
    expiresAt: data.expiresAt ?? "",
    usage: data.usage ?? {
      egressBytes: 0,
      ingressBytes: 0,
      periodStart: "",
      periodEnd: "",
    },
  };
  cacheCredentials(response);
  return response;
}

export function clearTurnCache(): void {
  localStorage.removeItem(TURN_CACHE_KEY);
}
