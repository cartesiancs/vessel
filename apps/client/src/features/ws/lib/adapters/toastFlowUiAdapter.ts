import { toast } from "sonner";
import type { FlowUiEventPayload, FlowUiEventToastData } from "@/features/ws";

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

/** Maps `flow_ui_event` with kind `toast` to Sonner. */
export function toastFlowUiAdapter(payload: FlowUiEventPayload): void {
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
}
