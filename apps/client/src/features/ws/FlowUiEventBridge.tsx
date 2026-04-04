import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useWebSocketMessage } from "./WebSocketProvider";
import {
  getFlowRunSessionId,
  type FlowUiEventPayload,
  type FlowUiEventToastData,
  type WebSocketMessage,
} from "./ws";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asToastData(raw: unknown): FlowUiEventToastData | null {
  if (!isRecord(raw)) return null;
  const message = raw.message;
  if (typeof message !== "string") return null;
  const level =
    typeof raw.level === "string" ? raw.level.toLowerCase() : "info";
  return {
    level,
    title:
      typeof raw.title === "string"
        ? raw.title
        : raw.title === null
          ? null
          : undefined,
    message,
    duration_ms:
      typeof raw.duration_ms === "number" ? raw.duration_ms : undefined,
  };
}

/** Subscribes once app-wide: maps `flow_ui_event` → Sonner for this tab's session only. */
export function FlowUiEventBridge() {
  const sessionId = useMemo(() => getFlowRunSessionId(), []);

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      if (msg.type !== "flow_ui_event") return;
      const payload = msg.payload as FlowUiEventPayload;
      if (
        !payload?.target?.session_id ||
        payload.target.session_id !== sessionId
      )
        return;
      if (payload.event?.kind !== "toast") return;

      const data = asToastData(payload.event.data);
      if (!data) return;

      const duration = data.duration_ms ?? 4000;
      const title = data.title?.trim();
      const message = data.message;

      const opts = title
        ? ({ duration, description: message } as const)
        : ({ duration } as const);

      switch (data.level) {
        case "success":
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          title
            ? toast.success(title, opts)
            : toast.success(message, { duration });
          break;
        case "warning":
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          title
            ? toast.warning(title, opts)
            : toast.warning(message, { duration });
          break;
        case "error":
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          title ? toast.error(title, opts) : toast.error(message, { duration });
          break;
        default:
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          title ? toast(title, opts) : toast(message, { duration });
      }
    },
    [sessionId],
  );

  useWebSocketMessage(handleMessage);
  return null;
}
