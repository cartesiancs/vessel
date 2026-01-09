import { WebSocketMessage } from "./ws";

export class MockWebSocketChannel {
  private connected = false;
  private messageListeners: Set<(msg: WebSocketMessage) => void> = new Set();
  private intervals: number[] = [];
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  private emit(message: WebSocketMessage) {
    this.messageListeners.forEach((listener) => listener(message));
  }

  connect(): void {
    if (this.connected) return;
    this.connected = true;
    this.onopen?.();

    this.intervals.push(
      window.setInterval(() => {
        this.emit({
          type: "get_server",
          payload: {
            cpu_usage: 12 + Math.random() * 10,
            memory_usage: 25 + Math.random() * 5,
          },
        });
      }, 2000),
    );

    this.intervals.push(
      window.setInterval(() => {
        this.emit({
          type: "log_message",
          payload: { level: "info", message: "Demo log entry" },
        });
      }, 5000),
    );

    this.emit({
      type: "stream_state",
      payload: [
        { topic: "sensors/temperature", is_online: true },
        { topic: "drone/front-camera", is_online: true },
      ],
    });
  }

  send(message: WebSocketMessage): void {
    if (!this.connected) return;

    if (message.type === "get_all_stream_state") {
      this.emit({
        type: "stream_state",
        payload: [
          { topic: "sensors/temperature", is_online: true },
          { topic: "drone/front-camera", is_online: true },
        ],
      });
    }

    if (message.type === "ping") {
      this.emit({
        type: "pong",
        payload: {
          timestamp: (message.payload as { timestamp: number }).timestamp,
        },
      });
    }

    if (message.type === "get_server") {
      this.emit({
        type: "get_server",
        payload: {
          cpu_usage: 15 + Math.random() * 5,
          memory_usage: 30 + Math.random() * 5,
        },
      });
    }
  }

  close(): void {
    if (!this.connected) return;
    this.connected = false;
    this.intervals.forEach((id) => clearInterval(id));
    this.intervals = [];
    this.onclose?.();
  }

  addMessageListener(listener: (msg: WebSocketMessage) => void): void {
    this.messageListeners.add(listener);
  }

  removeMessageListener(listener: (msg: WebSocketMessage) => void): void {
    this.messageListeners.delete(listener);
  }
}
