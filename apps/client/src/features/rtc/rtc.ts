import { WebSocketChannel, WebSocketMessage } from "../ws/ws";

export class WebRTCManager {
  private pc: RTCPeerConnection;
  private signaling: WebSocketChannel;
  public streams: Map<string, MediaStream>;
  private onStreamsChanged: (streams: Map<string, MediaStream>) => void;

  constructor(
    signaling: WebSocketChannel,
    onStreamsChanged: (streams: Map<string, MediaStream>) => void,
  ) {
    this.signaling = signaling;
    this.streams = new Map();
    this.onStreamsChanged = onStreamsChanged;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.setupEvents();
  }

  private setupEvents(): void {
    this.signaling.addMessageListener(this.handleSignalingMessage);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: "candidate",
          payload: event.candidate.toJSON(),
        });
      }
    };

    this.pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        console.log(
          `Track received: ${event.track.kind}, Stream ID: ${stream.id}`,
        );
        if (!this.streams.has(stream.id)) {
          this.streams.set(stream.id, stream);
          this.onStreamsChanged(new Map(this.streams));
        }
      }
    };
  }

  private handleSignalingMessage = async (msg: WebSocketMessage) => {
    try {
      switch (msg.type) {
        case "answer":
          console.log("Received initial answer");
          await this.pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit),
          );
          break;

        case "offer": {
          console.log("Received renegotiation offer from server");
          await this.pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit),
          );
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.signaling.send({
            type: "answer",
            payload: this.pc.localDescription as RTCSessionDescriptionInit,
          });
          console.log("Sent answer for renegotiation");
          break;
        }

        case "candidate":
          if (msg.payload) {
            await this.pc.addIceCandidate(
              new RTCIceCandidate(msg.payload as RTCIceCandidateInit),
            );
          }
          break;
      }
    } catch (err) {
      console.error("Error handling signaling message:", err);
    }
  };

  public async connect(): Promise<void> {
    try {
      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("audio", { direction: "recvonly" });

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.signaling.send({
        type: "offer",
        payload: this.pc.localDescription as RTCSessionDescriptionInit,
      });
      console.log("Initial offer sent to server.");
    } catch (err) {
      console.error("Error creating initial offer:", err);
    }
  }

  public subscribe(topic: string): void {
    console.log(`Subscribing to topic: ${topic}`);
    this.signaling.send({
      type: "subscribe_stream",
      payload: { topic },
    });
  }

  public close(): void {
    this.signaling.removeMessageListener(this.handleSignalingMessage);
    if (this.pc) {
      this.pc.close();
    }
    this.streams.clear();
    this.onStreamsChanged(new Map(this.streams));
    console.log("WebRTCManager closed.");
  }
}
