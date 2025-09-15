import { WebSocketChannel, WebSocketMessage } from "../ws/ws";

export class WebRTCManager {
  private pc: RTCPeerConnection;
  private signaling: WebSocketChannel;
  public streams: Map<string, MediaStream>;
  private onStreamsChanged: (streams: Map<string, MediaStream>) => void;
  private pendingTopics: string[];
  private candidateQueue: RTCIceCandidateInit[] = [];

  constructor(
    signaling: WebSocketChannel,
    onStreamsChanged: (streams: Map<string, MediaStream>) => void,
  ) {
    this.signaling = signaling;
    this.streams = new Map();
    this.pendingTopics = [];
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
      const topic = this.pendingTopics.shift();
      if (!topic) {
        return;
      }

      const track = event.track;
      const stream = new MediaStream([track]);

      console.log(
        `Track received for topic "${topic}": ${track.kind}, New Stream ID: ${stream.id}`,
      );

      if (!this.streams.has(topic)) {
        this.streams.set(topic, stream);
        this.onStreamsChanged(new Map(this.streams));
      }
    };
  }

  private handleSignalingMessage = async (msg: WebSocketMessage) => {
    try {
      switch (msg.type) {
        case "answer":
          await this.pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit),
          );
          this.processCandidateQueue();
          break;

        case "offer": {
          await this.pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit),
          );
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.signaling.send({
            type: "answer",
            payload: this.pc.localDescription as RTCSessionDescriptionInit,
          });
          this.processCandidateQueue();
          break;
        }

        case "candidate":
          if (msg.payload) {
            const candidate = new RTCIceCandidate(
              msg.payload as RTCIceCandidateInit,
            );
            if (this.pc.remoteDescription) {
              await this.pc.addIceCandidate(candidate);
            } else {
              this.candidateQueue.push(candidate);
            }
          }
          break;
      }
    } catch (err) {
      console.error("Error handling signaling message:", err);
    }
  };

  private processCandidateQueue = async () => {
    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(candidate);
        } catch (error) {
          console.error("Error processing queued candidate:", error);
        }
      }
    }
  };

  public async connect(): Promise<void> {
    try {
      this.pc.addTransceiver("audio", { direction: "recvonly" });
      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("video", { direction: "recvonly" });
      this.pc.addTransceiver("video", { direction: "recvonly" });

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.signaling.send({
        type: "offer",
        payload: this.pc.localDescription as RTCSessionDescriptionInit,
      });
    } catch (err) {
      console.error("Error creating initial offer:", err);
    }
  }

  public subscribe(topic: string): void {
    console.log(`Subscribing to topic: ${topic}`);
    this.pendingTopics.push(topic);

    this.signaling.send({
      type: "subscribe_stream",
      payload: { topic },
    });
  }

  public close(): void {
    this.signaling.send({ type: "hangup", payload: "" });

    this.signaling.removeMessageListener(this.handleSignalingMessage);
    if (this.pc) {
      this.pc.close();
    }
    this.streams.clear();
    this.onStreamsChanged(new Map(this.streams));
    console.log("WebRTCManager closed.");
  }
}
