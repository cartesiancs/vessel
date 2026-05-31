import type { FlowUiEventPayload } from "./ws";

export type FlowUiEventAdapter = (payload: FlowUiEventPayload) => void;

const defaultRegistry = (): Map<string, FlowUiEventAdapter> => new Map();

/**
 * Routes flow-driven UI events by `event.kind`. Register adapters once; unknown kinds are ignored.
 */
export function createFlowUiEventRouter(
  adapters: Map<string, FlowUiEventAdapter>,
) {
  return {
    dispatch(payload: FlowUiEventPayload): void {
      const kind = payload.event?.kind;
      if (!kind || typeof kind !== "string") return;
      const adapter = adapters.get(kind);
      adapter?.(payload);
    },
  };
}

/** @internal */
export function mergeFlowUiAdapters(
  ...entries: Array<[string, FlowUiEventAdapter]>
): Map<string, FlowUiEventAdapter> {
  const m = defaultRegistry();
  for (const [k, v] of entries) {
    m.set(k, v);
  }
  return m;
}
