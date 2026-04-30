import type { SystemConfiguration } from "../model/types";

export const STREAM_MODE_CONFIG_KEY = "default_stream_mode";

export type StreamMode = "webrtc" | "http";

const DEFAULT_MODE: StreamMode = "webrtc";

export function getDefaultStreamMode(
  configurations: SystemConfiguration[],
): StreamMode {
  const row = configurations.find((c) => c.key === STREAM_MODE_CONFIG_KEY);
  if (!row) return DEFAULT_MODE;
  return row.value === "http" ? "http" : "webrtc";
}
