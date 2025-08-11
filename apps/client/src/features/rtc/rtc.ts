type SignalingMessage = {
  type?:
    | "offer"
    | "answer"
    | "candidate"
    | "health_check"
    | "subscribe_stream"
    | "health_check_response";
  payload:
    | RTCSessionDescriptionInit
    | RTCIceCandidate
    | RTCIceCandidateInit
    | string
    | { topic: string };
};

class SignalingChannel {
  private ws: WebSocket | null = null;
  public onopen: (() => void) | null = null;
  public onmessage: ((msg: SignalingMessage) => void) | null = null;

  connect(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.onopen?.();
    this.ws.onmessage = (event) => this.onmessage?.(JSON.parse(event.data));
    this.ws.onerror = (err) => console.error("WebSocket Error:", err);
  }
  send(message: SignalingMessage): void {
    this.ws?.send(JSON.stringify(message));
  }
  close(): void {
    this.ws?.close();
  }
}

export class WebRTCManager {
  private pc: RTCPeerConnection;
  private signaling: SignalingChannel;
  private audioRef: React.RefObject<HTMLAudioElement | null>;

  constructor(audioRef: React.RefObject<HTMLAudioElement | null>) {
    this.audioRef = audioRef;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.signaling = new SignalingChannel();
    this.setupEvents();
  }

  private setupEvents(): void {
    this.pc.ontrack = (event) => {
      console.log("Track received:", event.track);
      if (this.audioRef.current && event.streams[0]) {
        this.audioRef.current.srcObject = event.streams[0];
        this.audioRef.current.play().catch((e) => {
          console.error("Audio play failed:", e);
        });
      }
    };

    this.signaling.onmessage = async (msg) => {
      console.log("Received signaling message:", msg);
      try {
        if (msg.type === "answer") {
          await this.pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit),
          );
        } else if (msg.type === "candidate") {
          await this.pc.addIceCandidate(
            new RTCIceCandidate(msg.payload as RTCIceCandidateInit),
          );
        } else if (msg.type === "health_check_response") {
          console.log("Health check response:", msg.payload);
        }
      } catch (err) {
        console.error("Error handling signaling message:", err);
      }
    };
  }

  public async createAndSendOffer(): Promise<void> {
    try {
      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling.send({
            type: "candidate",
            payload: event.candidate.toJSON() as RTCIceCandidateInit,
          });
        }
      };

      this.pc.addTransceiver("audio", { direction: "recvonly" });

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.signaling.send({
        type: "offer",
        payload: this.pc.localDescription as RTCSessionDescriptionInit,
      });
      console.log("Offer sent to server.");
    } catch (err) {
      console.error("Error creating offer:", err);
    }
  }

  public connect(url: string, onOpenCallback: () => void): void {
    this.signaling.onopen = onOpenCallback;
    this.signaling.connect(url);
  }

  public subscribe(topic: string) {
    console.log(`Subscribing to topic: ${topic}`);
    this.signaling.send({
      type: "subscribe_stream",
      payload: { topic: topic },
    });
  }

  public sendHealthCheck() {
    this.signaling.send({
      type: "health_check",
      payload: "ping from client",
    });
  }

  public close(): void {
    this.pc.close();
    this.signaling.close();
  }
}
