import {
  DASHBOARD_COMPONENT_EVENT_VERSION,
  type DashboardComponentEventPayload,
  type DashboardComponentAction,
  type DashboardComponentType,
} from "@/entities/dynamic-dashboard/interaction";
import type { WebSocketMessage } from "@/features/ws/ws";

export const DEFAULT_DASHBOARD_COOLDOWN_MS = 320;
export const MIN_DASHBOARD_COOLDOWN_MS = 100;

const createEventId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export type DashboardEventDispatchContext = {
  dashboard_id: string;
  group_id: string;
  item_id: string;
  listener_id: string;
  component_type: DashboardComponentType;
  action: DashboardComponentAction;
  value?: unknown;
  source_session_id: string;
  debounce_ms?: number;
  cooldown_ms?: number;
};

export type DashboardEventDispatcherDeps = {
  send: (msg: WebSocketMessage) => void;
  isConnected: () => boolean;
};

/**
 * Coalesces rapid events (debounce) and enforces cooldown between sends.
 */
export function createDashboardEventDispatcher(deps: DashboardEventDispatcherDeps) {
  const lastSentByKey = new Map<string, number>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const cooldownMsFor = (ctx: DashboardEventDispatchContext) =>
    Math.max(
      MIN_DASHBOARD_COOLDOWN_MS,
      ctx.cooldown_ms ?? DEFAULT_DASHBOARD_COOLDOWN_MS,
    );

  const debounceFor = (ctx: DashboardEventDispatchContext) =>
    Math.max(0, ctx.debounce_ms ?? 0);

  function buildPayload(
    ctx: DashboardEventDispatchContext,
  ): DashboardComponentEventPayload {
    return {
      event_version: DASHBOARD_COMPONENT_EVENT_VERSION,
      event_id: createEventId(),
      occurred_at: new Date().toISOString(),
      listener_id: ctx.listener_id.trim(),
      dashboard_id: ctx.dashboard_id,
      group_id: ctx.group_id,
      item_id: ctx.item_id,
      component_type: ctx.component_type,
      action: ctx.action,
      value: ctx.value,
      source_session_id: ctx.source_session_id,
      cooldown_ms: ctx.cooldown_ms,
    };
  }

  function sendNow(ctx: DashboardEventDispatchContext) {
    if (!deps.isConnected()) {
      return;
    }
    const key = `${ctx.listener_id}:${ctx.item_id}:${ctx.action}`;
    const now = Date.now();
    const last = lastSentByKey.get(key) ?? 0;
    if (now - last < cooldownMsFor(ctx)) {
      return;
    }
    lastSentByKey.set(key, now);

    const payload = buildPayload(ctx);
    deps.send({
      type: "dashboard_component_event",
      payload,
    } as WebSocketMessage);
  }

  return {
    dispatch(ctx: DashboardEventDispatchContext) {
      const ms = debounceFor(ctx);
      const key = `${ctx.listener_id}:${ctx.item_id}:${ctx.action}`;
      if (ms <= 0) {
        sendNow(ctx);
        return;
      }
      const existing = debounceTimers.get(key);
      if (existing) {
        clearTimeout(existing);
      }
      debounceTimers.set(
        key,
        setTimeout(() => {
          debounceTimers.delete(key);
          sendNow(ctx);
        }, ms),
      );
    },
    _reset() {
      lastSentByKey.clear();
      for (const t of debounceTimers.values()) {
        clearTimeout(t);
      }
      debounceTimers.clear();
    },
  };
}

export type DashboardEventDispatcher = ReturnType<
  typeof createDashboardEventDispatcher
>;
