import type { DashboardComponentEventPayload } from "@/entities/dynamic-dashboard/interaction";

/** Flow-driven UI events (toast, etc.); client should filter by `target.session_id`. */
export type FlowUiEventPayload = {
  target: { session_id: string };
  event: { kind: string; data: unknown };
  meta?: {
    flow_id?: number;
    node_id?: string;
    node_type?: string;
    /** Optional routing hint for dashboard widgets (set by flow nodes). */
    dashboard_item_id?: string;
  };
};

export type FlowUiEventToastData = {
  level: string;
  title?: string | null;
  message: string;
  duration_ms?: number;
};

export type WebSocketMessage = {
  type?:
    | "offer"
    | "answer"
    | "candidate"
    | "health_check"
    | "subscribe_stream"
    | "health_check_response"
    | "compute_flow"
    | "log_message"
    | "flow_ui_event"
    | "ping"
    | "pong"
    | "get_all_flows"
    | "get_all_flows_response"
    | "stop_flow"
    | "dashboard_component_event"
    | "get_all_stream_state"
    | "stream_state"
    | "change_state"
    | "hangup"
    | "get_server";
  payload:
    | RTCSessionDescriptionInit
    | RTCIceCandidate
    | RTCIceCandidateInit
    | string
    | number
    | object
    | { topic: string }
    | { flow_id: number }
    | { timestamp: number }
    | { id: number; name: string; is_running: boolean }[]
    | { cpu_usage: number; memory_usage: number }
    | FlowUiEventPayload
    | DashboardComponentEventPayload;
};

const FLOW_RUN_SESSION_STORAGE_KEY = "vessel_flow_run_session_id";

/** Per browser tab; include in `compute_flow` so server UI events target the initiating session. */
export function getFlowRunSessionId(): string {
  try {
    let id = sessionStorage.getItem(FLOW_RUN_SESSION_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(FLOW_RUN_SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export class WebSocketChannel {
  private ws: WebSocket | null = null;
  private messageListeners: Set<(msg: WebSocketMessage) => void> = new Set();
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string): void {
    if (this.isConnected()) {
      return;
    }
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.onopen?.();

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.messageListeners.forEach((listener) => listener(message));
    };

    this.ws.onerror = (err) => console.error("WebSocket Error:", err);
    this.ws.onclose = () => this.onclose?.();
  }

  send(message: WebSocketMessage): void {
    if (!this.isConnected()) {
      return;
    }

    try {
      if (this.ws) {
        this.ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.log(error);
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  addMessageListener(listener: (msg: WebSocketMessage) => void): void {
    this.messageListeners.add(listener);
  }

  removeMessageListener(listener: (msg: WebSocketMessage) => void): void {
    this.messageListeners.delete(listener);
  }
}
