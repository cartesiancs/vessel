type SignalingMessage = {
  type?: "offer" | "answer" | "candidate" | "health_check";
  payload:
    | RTCSessionDescriptionInit
    | RTCIceCandidate
    | RTCSessionDescriptionInit
    | string;
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
      if (this.audioRef.current) {
        this.audioRef.current.srcObject = event.streams[0];
        this.audioRef.current.play().catch(() => {});
      }
    };

    this.signaling.onmessage = async (msg) => {
      console.log("Received signaling message:", msg);
      if (msg.type == "answer") {
        await this.pc.setRemoteDescription(
          new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit),
        );
      }
      if (msg.type == "candidate") {
        await this.pc.addIceCandidate(
          new RTCIceCandidate(msg.payload as RTCIceCandidateInit),
        );
      }
    };

    this.signaling.onopen = async () => {
      this.pc.addTransceiver("audio", { direction: "recvonly" });
      this.pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.signaling.send({
            type: "candidate",
            payload: e.candidate,
          });
          this.signaling.send({
            type: "health_check",
            payload: "test",
          });
        }
      };
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.signaling.send({
        type: "offer",

        payload: this.pc.localDescription as RTCSessionDescriptionInit,
      });
    };
  }

  public connect(url: string): void {
    this.signaling.connect(url);
  }

  public close(): void {
    this.pc.close();
    this.signaling.close();
  }
}
