import { WebSocketChannel, WebSocketMessage } from "../../ws";

export type StreamKind = "audio" | "video";

// The server names each forwarded track's media stream "webrtc-stream-<kind>-<topic>"
// (apps/server/src/handler/ws/handlers.rs, add_forwarded_track).
const SERVER_STREAM_ID_PREFIX = "webrtc-stream-";

/** Topic a remote track carries, from the stream id the server gave it; null for other tracks. */
export function topicOfTrack(
  event: Pick<RTCTrackEvent, "track" | "streams">,
): string | null {
  const prefix = `${SERVER_STREAM_ID_PREFIX}${event.track.kind}-`;
  const stream = event.streams.find((s) => s.id.startsWith(prefix));
  return stream ? stream.id.slice(prefix.length) : null;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  /**
   * Topics this viewer wants, shared across manager instances. A replacement manager (after a
   * WebSocket reconnect or a failed peer connection) subscribes to them again on connect.
   */
  subscriptions?: Map<string, StreamKind>;
  /** Called once when the peer connection reaches "failed"; the owner should replace the manager. */
  onConnectionFailed?: () => void;
}

export class WebRTCManager {
  private pc: RTCPeerConnection;
  private signaling: WebSocketChannel;
  public streams: Map<string, { stream: MediaStream; type: "audio" | "video" }>;
  private onStreamsChanged: (
    streams: Map<string, { stream: MediaStream; type: "audio" | "video" }>,
  ) => void;
  private candidateQueue: RTCIceCandidateInit[] = [];
  private subscriptions: Map<string, StreamKind>;
  private onConnectionFailed: (() => void) | undefined;
  // Signaling messages are applied one at a time. Two renegotiation offers sent back to back
  // (one per subscribe) otherwise interleave, and the second setLocalDescription fails with
  // "Called in wrong state: stable", leaving the server's offer unanswered.
  private signalingChain: Promise<void> = Promise.resolve();

  public static readonly MAX_AUDIO_STREAMS = 2;
  public static readonly MAX_VIDEO_STREAMS = 4;

  constructor(
    signaling: WebSocketChannel,
    onStreamsChanged: (
      streams: Map<string, { stream: MediaStream; type: "audio" | "video" }>,
    ) => void,
    config?: WebRTCConfig,
  ) {
    this.signaling = signaling;
    this.streams = new Map();
    this.onStreamsChanged = onStreamsChanged;
    this.subscriptions = config?.subscriptions ?? new Map();
    this.onConnectionFailed = config?.onConnectionFailed;
    const iceServers = config?.iceServers ?? [];
    this.pc = new RTCPeerConnection({ iceServers });
    this.setupEvents();
  }

  private setupEvents(): void {
    this.signaling.addMessageListener(this.handleSignalingMessage);

    this.pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection state:", this.pc.iceConnectionState);
    };

    this.pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", this.pc.connectionState);
      if (this.pc.connectionState === "failed") {
        const notify = this.onConnectionFailed;
        this.onConnectionFailed = undefined;
        notify?.();
      }
    };

    this.pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] ICE gathering state:", this.pc.iceGatheringState);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type ?? "unknown";
        console.log(
          `[WebRTC] Local candidate [${type}]:`,
          event.candidate.candidate,
        );
        this.signaling.send({
          type: "candidate",
          payload: event.candidate.toJSON(),
        });
      } else {
        console.log("[WebRTC] ICE gathering complete");
      }
    };

    this.pc.ontrack = (event) => {
      const track = event.track;
      const topic = topicOfTrack(event);
      // The server's first answer marks every recvonly transceiver sendonly, which fires a track
      // event per transceiver with no media and random ids. Matching tracks to subscriptions in
      // arrival order let one of those claim a topic whenever a subscription was already pending
      // (as when a replacement manager resubscribes), leaving the view black.
      if (!topic || !this.subscriptions.has(topic)) {
        return;
      }
      const type = this.subscriptions.get(topic) ?? (track.kind as StreamKind);
      const stream = new MediaStream([track]);

      console.log(` "${topic}": ${track.kind} : ${stream.id}`);

      if (!this.streams.has(topic)) {
        this.streams.set(topic, { stream, type });
        this.onStreamsChanged(new Map(this.streams));
      }
    };
  }

  private handleSignalingMessage = (msg: WebSocketMessage) => {
    this.signalingChain = this.signalingChain.then(() =>
      this.applySignalingMessage(msg),
    );
  };

  /** Resolves once every signaling message received so far has been applied. */
  public whenSignalingIdle(): Promise<void> {
    return this.signalingChain;
  }

  private applySignalingMessage = async (msg: WebSocketMessage) => {
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
            const candidateInit = msg.payload as RTCIceCandidateInit;
            if (this.pc.remoteDescription) {
              await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
            } else {
              this.candidateQueue.push(candidateInit);
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
      for (let i = 0; i < WebRTCManager.MAX_AUDIO_STREAMS; i++) {
        this.pc.addTransceiver("audio", { direction: "recvonly" });
      }
      for (let i = 0; i < WebRTCManager.MAX_VIDEO_STREAMS; i++) {
        this.pc.addTransceiver("video", { direction: "recvonly" });
      }

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.signaling.send({
        type: "offer",
        payload: this.pc.localDescription as RTCSessionDescriptionInit,
      });
      // The server handles messages in order, so these follow the offer it is answering.
      for (const [topic, type] of this.subscriptions) {
        this.requestStream(topic, type);
      }
    } catch (err) {
      console.error("Error creating initial offer:", err);
    }
  }

  public subscribe(topic: string, streamType: "audio" | "video"): void {
    const currentStreams = Array.from(this.streams.values());
    const audioCount = currentStreams.filter((s) => s.type === "audio").length;
    const videoCount = currentStreams.filter((s) => s.type === "video").length;

    if (
      streamType === "audio" &&
      audioCount >= WebRTCManager.MAX_AUDIO_STREAMS
    ) {
      console.warn("Max audio streams reached. Cannot subscribe.");
      return;
    }

    if (
      streamType === "video" &&
      videoCount >= WebRTCManager.MAX_VIDEO_STREAMS
    ) {
      console.warn("Max video streams reached. Cannot subscribe.");
      return;
    }

    this.subscriptions.set(topic, streamType);
    this.requestStream(topic, streamType);
  }

  private requestStream(topic: string, streamType: StreamKind): void {
    console.log(`Subscribing to topic: ${topic} (${streamType})`);

    this.signaling.send({
      type: "subscribe_stream",
      payload: { topic },
    });
  }

  public close(): void {
    this.onConnectionFailed = undefined;
    this.signaling.send({ type: "hangup", payload: "" });

    this.signaling.removeMessageListener(this.handleSignalingMessage);
    if (this.pc) {
      this.pc.close();
    }
    this.streams.clear();
    this.onStreamsChanged(new Map(this.streams));
  }
}
