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
    | "ping"
    | "pong"
    | "get_all_flows"
    | "get_all_flows_response"
    | "stop_flow"
    | "get_all_stream_state"
    | "stream_state"
    | "get_server";
  payload:
    | RTCSessionDescriptionInit
    | RTCIceCandidate
    | RTCIceCandidateInit
    | string
    | number
    | { topic: string }
    | { flow_id: number }
    | { timestamp: number }
    | { id: number; name: string; is_running: boolean }[]
    | { cpu_usage: number; memory_usage: number };
};

export class WebSocketChannel {
  private ws: WebSocket | null = null;
  private messageListeners: Set<(msg: WebSocketMessage) => void> = new Set();
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;

  connect(url: string): void {
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
    this.ws?.send(JSON.stringify(message));
  }

  close(): void {
    this.ws?.close();
  }

  addMessageListener(listener: (msg: WebSocketMessage) => void): void {
    this.messageListeners.add(listener);
  }

  removeMessageListener(listener: (msg: WebSocketMessage) => void): void {
    this.messageListeners.delete(listener);
  }
}
