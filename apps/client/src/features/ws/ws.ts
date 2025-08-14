export type WebSocketMessage = {
  type?:
    | "offer"
    | "answer"
    | "candidate"
    | "health_check"
    | "subscribe_stream"
    | "health_check_response"
    | "compute_flow"
    | "log_message";
  payload:
    | RTCSessionDescriptionInit
    | RTCIceCandidate
    | RTCIceCandidateInit
    | string
    | { topic: string }
    | { flow_id: number };
};

export class WebSocketChannel {
  private ws: WebSocket | null = null;
  public onopen: (() => void) | null = null;
  public onmessage: ((msg: WebSocketMessage) => void) | null = null;
  public onclose: (() => void) | null = null;

  connect(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.onopen?.();
    this.ws.onmessage = (event) => this.onmessage?.(JSON.parse(event.data));
    this.ws.onerror = (err) => console.error("WebSocket Error:", err);
    this.ws.onclose = () => this.onclose?.();
  }
  send(message: WebSocketMessage): void {
    this.ws?.send(JSON.stringify(message));
  }
  close(): void {
    this.ws?.close();
  }
}
