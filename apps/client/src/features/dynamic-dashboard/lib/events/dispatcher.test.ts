import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDashboardEventDispatcher } from "./dispatcher";
import { DASHBOARD_COMPONENT_EVENT_VERSION } from "@/entities/dynamic-dashboard";

describe("createDashboardEventDispatcher", () => {
  const baseCtx = {
    dashboard_id: "d1",
    group_id: "g1",
    item_id: "i1",
    listener_id: "btn-a",
    component_type: "button" as const,
    action: "click" as const,
    source_session_id: "sess-1",
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends dashboard_component_event v2 with listener_id", () => {
    const send = vi.fn();
    const d = createDashboardEventDispatcher({
      send,
      isConnected: () => true,
    });
    d.dispatch(baseCtx);
    expect(send).toHaveBeenCalledTimes(1);
    const msg = send.mock.calls[0][0] as {
      type: string;
      payload: {
        event_version: number;
        listener_id: string;
      };
    };
    expect(msg.type).toBe("dashboard_component_event");
    expect(msg.payload.event_version).toBe(DASHBOARD_COMPONENT_EVENT_VERSION);
    expect(msg.payload.listener_id).toBe("btn-a");
  });

  it("does not send when disconnected", () => {
    const send = vi.fn();
    const d = createDashboardEventDispatcher({
      send,
      isConnected: () => false,
    });
    d.dispatch(baseCtx);
    expect(send).not.toHaveBeenCalled();
  });

  it("enforces cooldown between same listener+item+action", () => {
    const send = vi.fn();
    const d = createDashboardEventDispatcher({
      send,
      isConnected: () => true,
    });
    const t0 = new Date("2024-01-01T00:00:00.000Z").getTime();
    vi.setSystemTime(t0);
    d.dispatch({ ...baseCtx, cooldown_ms: 500 });
    d.dispatch({ ...baseCtx, cooldown_ms: 500 });
    expect(send).toHaveBeenCalledTimes(1);
    vi.setSystemTime(t0 + 600);
    d.dispatch({ ...baseCtx, cooldown_ms: 500 });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
