import { WebSocketChannel, WebSocketMessage } from "../ws/ws";

export class WebRTCManager {
  private pc: RTCPeerConnection;
  private signaling: WebSocketChannel;
  private audioRef: React.RefObject<HTMLAudioElement | null>;

  constructor(
    audioRef: React.RefObject<HTMLAudioElement | null>,
    signaling: WebSocketChannel,
  ) {
    this.audioRef = audioRef;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.signaling = signaling;
    this.setupEvents();
  }

  private handleSignalingMessage = async (msg: WebSocketMessage) => {
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

    this.signaling.addMessageListener(this.handleSignalingMessage);
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

  public connect(onOpenCallback: () => void): void {
    this.signaling.onopen = onOpenCallback;
  }

  public subscribe(topic: string) {
    console.log(`Subscribing to topic: ${topic}`);
    console.log(this.signaling);
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
    this.signaling.removeMessageListener(this.handleSignalingMessage);
    this.pc.close();
  }
}
