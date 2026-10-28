import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocketChannel, WebSocketMessage } from "../../ws";
import { WebRTCManager, type StreamKind } from "./rtc";

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
});
