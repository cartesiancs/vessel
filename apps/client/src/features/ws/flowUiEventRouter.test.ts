import { describe, it, expect, vi } from "vitest";
import { createFlowUiEventRouter, mergeFlowUiAdapters } from "./flowUiEventRouter";
import type { FlowUiEventPayload } from "./ws";

describe("createFlowUiEventRouter", () => {
  it("dispatches to the adapter for event.kind", () => {
    const custom = vi.fn();
    const router = createFlowUiEventRouter(
      mergeFlowUiAdapters(["custom", custom]),
    );
    const payload = {
      target: { session_id: "x" },
      event: { kind: "custom", data: { n: 1 } },
    } satisfies FlowUiEventPayload;
    router.dispatch(payload);
    expect(custom).toHaveBeenCalledWith(payload);
  });

  it("ignores unknown kinds", () => {
    const custom = vi.fn();
    const router = createFlowUiEventRouter(
      mergeFlowUiAdapters(["custom", custom]),
    );
    router.dispatch({
      target: { session_id: "x" },
      event: { kind: "other", data: {} },
    });
    expect(custom).not.toHaveBeenCalled();
  });
});
