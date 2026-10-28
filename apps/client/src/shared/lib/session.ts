import { storage } from "@/shared/lib/storage";
import { parseJwt } from "@/shared/lib/jwt";

// Refresh the access token when it is within this many seconds of expiry.
const REFRESH_THRESHOLD_SECS = 60;

type RefreshResult = { token: string; refreshToken: string | null } | null;

// Single-flight guard: concurrent callers share one in-flight refresh so we
// never spend a rotating refresh token more than once at a time.
let inFlight: Promise<RefreshResult> | null = null;

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/$/, "");

async function requestRefresh(
  baseUrl: string,
  refreshToken: string,
): Promise<RefreshResult> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!data.token) return null;

  return {
    token: data.token as string,
    refreshToken: (data.refreshToken as string) ?? null,
  };
}

/**
 * Rotate the active server's tokens exactly once even under concurrent calls.
 * Resolves to the new access token, or null when refresh is impossible
 * (no refresh token, server rejected it, etc.).
 */
export function refreshActiveSession(): Promise<string | null> {
  if (inFlight) {
    return inFlight.then((r) => r?.token ?? null);
  }

  const serverId = storage.getActiveServerId();
  const serverUrl = storage.getServerUrl();
  const refreshToken = storage.getRefreshToken();

  if (!serverId || !serverUrl || !refreshToken) {
    return Promise.resolve(null);
  }

  inFlight = (async () => {
    try {
      const result = await requestRefresh(serverUrl, refreshToken);
      if (result) {
        storage.updateServerTokens(serverId, {
          token: result.token,
          refreshToken: result.refreshToken ?? undefined,
        });
      }
      return result;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight.then((r) => r?.token ?? null);
}

function isExpiringSoon(token: string | null): boolean {
  const payload = parseJwt(token ?? undefined);
  if (!payload?.exp) return true;
  const nowSecs = Date.now() / 1000;
  return payload.exp - nowSecs <= REFRESH_THRESHOLD_SECS;
}

/**
 * Return a currently-valid access token, proactively refreshing it when it is
 * missing or about to expire. Returns null if no valid session can be obtained.
 * Use before building token-bearing URLs (WebSocket, media streams).
 */
export async function ensureFreshToken(): Promise<string | null> {
  const token = storage.getToken();
  if (token && !isExpiringSoon(token)) {
    return token;
  }
  return refreshActiveSession();
}
