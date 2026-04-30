/** Contract version for dashboard → flow WebSocket payloads (listener id + broadcast bus). */
export const DASHBOARD_COMPONENT_EVENT_VERSION = 2 as const;

export const MAX_LISTENER_ID_LENGTH = 128;

/** Match server: alphanumeric, underscore, hyphen only. */
export function isValidListenerId(id: string): boolean {
  const t = id.trim();
  if (!t || t.length > MAX_LISTENER_ID_LENGTH) return false;
  return /^[a-zA-Z0-9_-]+$/.test(t);
}

export type DashboardComponentType = "button" | string;

export type DashboardComponentAction = "click" | "change" | "submit" | string;

/**
 * Client → server: user interaction; server publishes to `dashboard_ui` for
 * `DASHBOARD_EVENT_LISTENER` nodes in **running** flows.
 */
export type DashboardComponentEventPayload = {
  event_version: typeof DASHBOARD_COMPONENT_EVENT_VERSION;
  event_id: string;
  occurred_at: string;
  listener_id: string;
  dashboard_id: string;
  group_id: string;
  item_id: string;
  component_type: DashboardComponentType;
  action: DashboardComponentAction;
  value?: unknown;
  source_session_id: string;
  cooldown_ms?: number;
};
