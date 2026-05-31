import { supabase } from "@/shared/lib/supabase";
import { getConfigs, updateConfig } from "@/entities/configurations";

export interface TurnUsage {
  egressBytes: number;
  ingressBytes: number;
  totalBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  isQuotaExceeded: boolean;
  periodStart: string;
  periodEnd: string;
}

export interface TurnCredentialsResponse {
  iceServers: RTCIceServer[];
  expiresAt: string;
  usage: TurnUsage;
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

export type TurnCredentialErrorCode =
  | "TURN_QUOTA_EXCEEDED"
  | "TURN_USAGE_UNAVAILABLE"
  | "TURN_ISSUE_FAILED";

export class TurnCredentialError extends Error {
  code: TurnCredentialErrorCode;
  status?: number;
  usage?: TurnUsage;

  constructor(
    code: TurnCredentialErrorCode,
    message: string,
    options: { status?: number; usage?: TurnUsage } = {},
  ) {
    super(message);
    this.name = "TurnCredentialError";
    this.code = code;
    this.status = options.status;
    this.usage = options.usage;
  }
}

export function isTurnCredentialError(error: unknown): error is TurnCredentialError {
  return error instanceof TurnCredentialError;
}

type TurnErrorCallback = (error: TurnCredentialError) => void;
const errorListeners = new Set<TurnErrorCallback>();

export function onTurnCredentialError(cb: TurnErrorCallback): () => void {
  errorListeners.add(cb);
  return () => {
    errorListeners.delete(cb);
  };
}

function notifyTurnCredentialError(error: TurnCredentialError): void {
  errorListeners.forEach((cb) => cb(error));
}

function getDefaultUsage(raw: Partial<TurnUsage> = {}): TurnUsage {
  const egressBytes = Number(raw.egressBytes ?? 0);
  const ingressBytes = Number(raw.ingressBytes ?? 0);
  const totalBytes = Number(raw.totalBytes ?? egressBytes + ingressBytes);
  const quotaBytes = Number(raw.quotaBytes ?? 0);
  const remainingBytes = Number(
    raw.remainingBytes ?? Math.max(0, quotaBytes - totalBytes),
  );

  return {
    egressBytes,
    ingressBytes,
    totalBytes,
    quotaBytes,
    remainingBytes,
    isQuotaExceeded: Boolean(
      raw.isQuotaExceeded ?? (quotaBytes > 0 && totalBytes >= quotaBytes),
    ),
    periodStart: raw.periodStart ?? "",
    periodEnd: raw.periodEnd ?? "",
  };
}

function getTurnErrorCode(errorCode?: string): TurnCredentialErrorCode {
  switch (errorCode) {
    case "turn_quota_exceeded":
      return "TURN_QUOTA_EXCEEDED";
    case "turn_usage_unavailable":
      return "TURN_USAGE_UNAVAILABLE";
    default:
      return "TURN_ISSUE_FAILED";
  }
}

async function parseInvokeError(error: unknown): Promise<TurnCredentialError> {
  const context =
    typeof error === "object" && error !== null && "context" in error
      ? Reflect.get(error, "context")
      : null;
  const status =
    typeof context === "object" && context !== null && "status" in context
      ? Number(Reflect.get(context, "status"))
      : undefined;

  let payload: Record<string, unknown> | null = null;
  if (
    typeof context === "object" &&
    context !== null &&
    "json" in context &&
    typeof Reflect.get(context, "json") === "function"
  ) {
    try {
      payload = await (context as Response).clone().json();
    } catch {
      payload = null;
    }
  }

  const rawCode =
    typeof payload?.error === "string"
      ? payload.error
      : typeof payload?.code === "string"
        ? payload.code
        : undefined;
  const message =
    typeof payload?.message === "string"
      ? payload.message
      : typeof payload?.error === "string"
        ? payload.error
        : error instanceof Error
          ? error.message
          : "Failed to fetch TURN credentials";

  return new TurnCredentialError(getTurnErrorCode(rawCode), message, {
    status,
    usage:
      payload && typeof payload.usage === "object" && payload.usage !== null
        ? getDefaultUsage(payload.usage as Partial<TurnUsage>)
        : undefined,
  });
}

function toTurnCredentialError(error: unknown): TurnCredentialError {
  if (isTurnCredentialError(error)) return error;

  if (error instanceof Error) {
    return new TurnCredentialError("TURN_ISSUE_FAILED", error.message);
  }

  return new TurnCredentialError(
    "TURN_ISSUE_FAILED",
    "Failed to fetch TURN credentials",
  );
}

function getTurnErrorSummary(error: TurnCredentialError): string | null {
  if (!error.usage?.quotaBytes) return null;

  const totalGb = (error.usage.totalBytes / 1024 ** 3).toFixed(2);
  const quotaGb = (error.usage.quotaBytes / 1024 ** 3).toFixed(2);
  const resetAt = error.usage.periodEnd
    ? new Date(error.usage.periodEnd).toLocaleString()
    : null;

  return resetAt
    ? `${totalGb} GB / ${quotaGb} GB used. Quota resets ${resetAt}.`
    : `${totalGb} GB / ${quotaGb} GB used this period.`;
}

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
    } catch (err) {
      const turnError = toTurnCredentialError(err);
      notifyTurnCredentialError(turnError);

      // Fallback: load from server DB (another session may have renewed)
      try {
        const serverConfig = await loadTurnConfigFromServer();
        if (serverConfig) {
          cacheCredentials({
            iceServers: serverConfig.iceServers,
            expiresAt: serverConfig.expiresAt,
            usage: getDefaultUsage(),
          });
          scheduleRenewal(serverConfig.expiresAt);
          notifyListeners(serverConfig.iceServers);
        } else {
          console.warn(
            "TURN credential auto-renewal failed: no valid credentials available",
            turnError,
          );
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
      usage: getDefaultUsage(),
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
    const turnError = toTurnCredentialError(err);
    notifyTurnCredentialError(turnError);
    console.warn("Failed to fetch TURN credentials, falling back to STUN:", turnError);
    return DEFAULT_ICE_SERVERS;
  }
}

/** Fetch fresh TURN credentials from edge function */
export async function fetchTurnCredentials(): Promise<TurnCredentialsResponse> {
  const { data, error } = await supabase.functions.invoke("turn-ice", {
    body: { strip_port_53: true },
  });

  if (error) {
    throw await parseInvokeError(error);
  }

  if (!data?.iceServers) {
    throw new TurnCredentialError(
      getTurnErrorCode(data?.error),
      data?.message ?? data?.error ?? "No iceServers in response",
      {
        usage:
          data?.usage && typeof data.usage === "object"
            ? getDefaultUsage(data.usage as Partial<TurnUsage>)
            : undefined,
      },
    );
  }

  const response: TurnCredentialsResponse = {
    iceServers: data.iceServers,
    expiresAt: data.expiresAt ?? "",
    usage:
      data.usage && typeof data.usage === "object"
        ? getDefaultUsage(data.usage as Partial<TurnUsage>)
        : getDefaultUsage(),
  };
  cacheCredentials(response);
  return response;
}

export function clearTurnCache(): void {
  localStorage.removeItem(TURN_CACHE_KEY);
}

export function getTurnCredentialErrorSummary(error: TurnCredentialError): string | null {
  return getTurnErrorSummary(error);
}
