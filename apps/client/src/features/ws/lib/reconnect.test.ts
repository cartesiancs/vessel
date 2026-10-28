import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  Reconnector,
  reconnectDelayMs,
} from "./reconnect";

const noJitter = () => 0.5;

describe("reconnectDelayMs", () => {
  it("doubles from the base delay and caps at the maximum", () => {
    expect(reconnectDelayMs(0, noJitter)).toBe(RECONNECT_BASE_DELAY_MS);
    expect(reconnectDelayMs(1, noJitter)).toBe(RECONNECT_BASE_DELAY_MS * 2);
    expect(reconnectDelayMs(3, noJitter)).toBe(RECONNECT_BASE_DELAY_MS * 8);
    expect(reconnectDelayMs(30, noJitter)).toBe(RECONNECT_MAX_DELAY_MS);
  });

  it("keeps jitter within 20%", () => {
    expect(reconnectDelayMs(0, () => 0)).toBe(RECONNECT_BASE_DELAY_MS * 0.8);
    expect(reconnectDelayMs(0, () => 1)).toBe(RECONNECT_BASE_DELAY_MS * 1.2);
  });
});

describe("Reconnector", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reconnects after a close, backing off while attempts keep failing", async () => {
    const reconnect = vi.fn();
    const r = new Reconnector(reconnect, noJitter);

    r.onClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS - 1);
    expect(reconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(reconnect).toHaveBeenCalledTimes(1);

    r.onClose(); // the attempt failed: the socket closed again
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS * 2);
    expect(reconnect).toHaveBeenCalledTimes(2);
  });

  it("resets the backoff once a connection opens", async () => {
    const reconnect = vi.fn();
    const r = new Reconnector(reconnect, noJitter);
    r.onClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
    r.onClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS * 2);
    r.onOpen();

    r.onClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
    expect(reconnect).toHaveBeenCalledTimes(3);
  });

  it("keeps a single pending attempt for repeated close events", async () => {
    const reconnect = vi.fn();
    const r = new Reconnector(reconnect, noJitter);
    r.onClose();
    r.onClose();
    r.onClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_DELAY_MS);
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it("retries when the reconnect callback throws", async () => {
    const reconnect = vi
      .fn()
      .mockRejectedValueOnce(new Error("token refresh failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = new Reconnector(reconnect, noJitter);
    r.onClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS * 2);
    expect(reconnect).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("does nothing after stop", async () => {
    const reconnect = vi.fn();
    const r = new Reconnector(reconnect, noJitter);
    r.onClose();
    r.stop();
    r.onClose();
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_DELAY_MS);
    expect(reconnect).not.toHaveBeenCalled();
  });
});
