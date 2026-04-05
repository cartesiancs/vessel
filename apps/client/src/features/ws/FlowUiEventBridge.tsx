import { useCallback, useMemo } from "react";
import { useWebSocketMessage } from "./WebSocketProvider";
import {
  getFlowRunSessionId,
  type FlowUiEventPayload,
  type WebSocketMessage,
} from "./ws";
import { createFlowUiEventRouter, mergeFlowUiAdapters } from "./flowUiEventRouter";
import { toastFlowUiAdapter } from "./flowUiAdapters/toastFlowUiAdapter";

/** Subscribes once app-wide: routes `flow_ui_event` → adapters for this tab's session only. */
export function FlowUiEventBridge() {
  const sessionId = useMemo(() => getFlowRunSessionId(), []);

  const router = useMemo(
    () =>
      createFlowUiEventRouter(
        mergeFlowUiAdapters(["toast", toastFlowUiAdapter]),
      ),
    [],
  );

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      if (msg.type !== "flow_ui_event") return;
      const payload = msg.payload as FlowUiEventPayload;
      if (
        !payload?.target?.session_id ||
        payload.target.session_id !== sessionId
      )
        return;
      router.dispatch(payload);
    },
    [router, sessionId],
  );

  useWebSocketMessage(handleMessage);
  return null;
}
