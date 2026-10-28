import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocketChannel, WebSocketMessage } from "../../ws";
import { WebRTCManager, topicOfTrack, type StreamKind } from "./rtc";

const SIGNALING_DELAY_MS = 20;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** RTCPeerConnection stand-in that tracks overlapping description calls like Chrome rejects them. */
class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  config: RTCConfiguration;
  signalingState: RTCSignalingState = "stable";
  connectionState: RTCPeerConnectionState = "new";
  iceConnectionState = "new";
  iceGatheringState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  inFlight = 0;
  maxInFlight = 0;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  onicecandidate: ((e: { candidate: null }) => void) | null = null;
  ontrack: ((e: unknown) => void) | null = null;

  constructor(config: RTCConfiguration) {
    this.config = config;
    FakePeerConnection.instances.push(this);
  }

  private async step<T>(fn: () => T): Promise<T> {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    await delay(SIGNALING_DELAY_MS);
    this.inFlight--;
    return fn();
  }

  addTransceiver() {}
  createOffer() {
    return this.step(() => ({ type: "offer" as const, sdp: "client-offer" }));
  }
  createAnswer() {
    return this.step(() => {
      if (this.signalingState !== "have-remote-offer") {
        throw new Error("Called in wrong state: stable");
      }
      return {
        type: "answer" as const,
        sdp: `answer-to-${this.remoteDescription?.sdp}`,
      };
    });
  }
  setLocalDescription(desc: RTCSessionDescriptionInit) {
    return this.step(() => {
      if (
        desc.type === "answer" &&
        this.signalingState !== "have-remote-offer"
      ) {
        throw new Error("Called in wrong state: stable");
      }
      this.localDescription = desc;
      this.signalingState =
        desc.type === "offer" ? "have-local-offer" : "stable";
    });
  }
  setRemoteDescription(desc: RTCSessionDescriptionInit) {
    return this.step(() => {
      this.remoteDescription = desc;
      this.signalingState =
        desc.type === "offer" ? "have-remote-offer" : "stable";
    });
  }
  addIceCandidate() {
    return Promise.resolve();
  }
  close() {
    this.connectionState = "closed";
  }

  fail() {
    this.connectionState = "failed";
    this.onconnectionstatechange?.();
  }
}

function fakeSignaling() {
  const sent: WebSocketMessage[] = [];
  const listeners = new Set<(msg: WebSocketMessage) => void>();
  const channel = {
    send: (msg: WebSocketMessage) => sent.push(msg),
    addMessageListener: (l: (msg: WebSocketMessage) => void) =>
      listeners.add(l),
    removeMessageListener: (l: (msg: WebSocketMessage) => void) =>
      listeners.delete(l),
  };
  const deliver = (msg: WebSocketMessage) => listeners.forEach((l) => l(msg));
  return { channel: channel as unknown as WebSocketChannel, sent, deliver };
}

beforeEach(() => {
  FakePeerConnection.instances = [];
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  vi.stubGlobal(
    "MediaStream",
    class {
      id = "local-stream";
      constructor(public tracks: unknown[]) {}
    },
  );
  vi.stubGlobal(
    "RTCSessionDescription",
    class {
      constructor(init: RTCSessionDescriptionInit) {
        return init;
      }
    },
  );
  vi.stubGlobal(
    "RTCIceCandidate",
    class {
      constructor(init: RTCIceCandidateInit) {
        return init;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebRTCManager", () => {
  it("answers back-to-back renegotiation offers one at a time, in order", async () => {
    const { channel, sent, deliver } = fakeSignaling();
    const manager = new WebRTCManager(channel, () => {}, { iceServers: [] });
    const pc = FakePeerConnection.instances[0];

    // The server sends one offer per subscribed topic without waiting for answers.
    deliver({ type: "offer", payload: { type: "offer", sdp: "first" } });
    deliver({ type: "offer", payload: { type: "offer", sdp: "second" } });
    await manager.whenSignalingIdle();

    const answers = sent.filter((m) => m.type === "answer");
    expect(
      answers.map((m) => (m.payload as RTCSessionDescriptionInit).sdp),
    ).toEqual(["answer-to-first", "answer-to-second"]);
    expect(pc.maxInFlight).toBe(1);
    expect(pc.signalingState).toBe("stable");
  });

  it("keeps processing after a message fails", async () => {
    const { channel, sent, deliver } = fakeSignaling();
    const manager = new WebRTCManager(channel, () => {}, { iceServers: [] });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    deliver({
      type: "answer",
      payload: null as unknown as RTCSessionDescriptionInit,
    });
    deliver({ type: "offer", payload: { type: "offer", sdp: "after-error" } });
    await manager.whenSignalingIdle();

    expect(sent.some((m) => m.type === "answer")).toBe(true);
    errors.mockRestore();
  });

  it("subscribes again to remembered topics when a replacement manager connects", async () => {
    const subscriptions = new Map<string, StreamKind>();
    const first = fakeSignaling();
    const manager = new WebRTCManager(first.channel, () => {}, {
      iceServers: [],
      subscriptions,
    });
    manager.subscribe("cam/video", "video");
    manager.subscribe("cam/audio", "audio");
    manager.close();

    const second = fakeSignaling();
    const replacement = new WebRTCManager(second.channel, () => {}, {
      iceServers: [],
      subscriptions,
    });
    await replacement.connect();

    expect(second.sent.map((m) => m.type)).toEqual([
      "offer",
      "subscribe_stream",
      "subscribe_stream",
    ]);
    expect(
      second.sent.slice(1).map((m) => (m.payload as { topic: string }).topic),
    ).toEqual(["cam/video", "cam/audio"]);
  });

  it("reports a failed peer connection once", () => {
    const { channel } = fakeSignaling();
    const onConnectionFailed = vi.fn();
    new WebRTCManager(channel, () => {}, {
      iceServers: [],
      onConnectionFailed,
    });
    const pc = FakePeerConnection.instances[0];

    pc.fail();
    pc.fail();

    expect(onConnectionFailed).toHaveBeenCalledTimes(1);
  });

  it("does not report failure after it was closed on purpose", () => {
    const { channel } = fakeSignaling();
    const onConnectionFailed = vi.fn();
    const manager = new WebRTCManager(channel, () => {}, {
      iceServers: [],
      onConnectionFailed,
    });
    manager.close();
    FakePeerConnection.instances[0].fail();

    expect(onConnectionFailed).not.toHaveBeenCalled();
  });

  it("binds a subscription to the server's track, not to placeholder tracks before it", () => {
    const { channel } = fakeSignaling();
    const changes: Array<
      Map<string, { stream: MediaStream; type: StreamKind }>
    > = [];
    const subscriptions = new Map<string, StreamKind>([["cam/video", "video"]]);
    new WebRTCManager(channel, (streams) => changes.push(streams), {
      iceServers: [],
      subscriptions,
    });
    const pc = FakePeerConnection.instances[0];

    // What Chrome fires for the server's first answer: one muted track per transceiver.
    const placeholder = { kind: "video", id: "243efcfe-987a" };
    pc.ontrack?.({ track: placeholder, streams: [{ id: "baaa6506-62b3" }] });
    expect(changes).toHaveLength(0);

    const real = { kind: "video", id: "video-cam/video" };
    pc.ontrack?.({
      track: real,
      streams: [{ id: "webrtc-stream-video-cam/video" }],
    });
    expect(changes).toHaveLength(1);
    const bound = changes[0].get("cam/video") as unknown as {
      stream: { tracks: unknown[] };
      type: StreamKind;
    };
    expect(bound.type).toBe("video");
    expect(bound.stream.tracks).toEqual([real]);
  });

  it("ignores tracks for topics this viewer did not subscribe to", () => {
    const { channel } = fakeSignaling();
    const onStreamsChanged = vi.fn();
    new WebRTCManager(channel, onStreamsChanged, { iceServers: [] });
    FakePeerConnection.instances[0].ontrack?.({
      track: { kind: "audio", id: "audio-other" },
      streams: [{ id: "webrtc-stream-audio-other" }],
    });
    expect(onStreamsChanged).not.toHaveBeenCalled();
  });
});

describe("topicOfTrack", () => {
  const event = (kind: string, ...streamIds: string[]) =>
    ({
      track: { kind } as MediaStreamTrack,
      streams: streamIds.map((id) => ({ id }) as MediaStream),
    }) as Pick<RTCTrackEvent, "track" | "streams">;

  it("reads the topic from the server's stream id, slashes included", () => {
    expect(
      topicOfTrack(event("video", "webrtc-stream-video-xiao/cam/video")),
    ).toBe("xiao/cam/video");
    expect(topicOfTrack(event("audio", "x", "webrtc-stream-audio-mic"))).toBe(
      "mic",
    );
  });

  it("returns null for tracks the server did not name", () => {
    expect(topicOfTrack(event("video", "baaa6506-62b3"))).toBeNull();
    expect(topicOfTrack(event("video"))).toBeNull();
    // A video track must not match an audio stream id.
    expect(topicOfTrack(event("video", "webrtc-stream-audio-mic"))).toBeNull();
  });
});
