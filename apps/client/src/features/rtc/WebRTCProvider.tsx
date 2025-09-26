import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
} from "react";
import { useWebSocket } from "../ws/WebSocketProvider";
import { WebRTCManager } from "./rtc";

type StreamInfo = {
  stream: MediaStream;
  type: "audio" | "video";
};

type WebRTCContextType = {
  rtcManager: WebRTCManager | null;
  streams: Map<string, StreamInfo>;
  audioStreamCount: number;
  videoStreamCount: number;
};

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export function useWebRTC() {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error("useWebRTC must be used within a WebRTCProvider");
  }
  return context;
}

type WebRTCProviderProps = {
  children: ReactNode;
};

export function WebRTCProvider({ children }: WebRTCProviderProps) {
  const { wsManager, isConnected } = useWebSocket();
  const [rtcManager, setRtcManager] = useState<WebRTCManager | null>(null);
  const [streams, setStreams] = useState<Map<string, StreamInfo>>(new Map());

  useEffect(() => {
    if (isConnected && wsManager) {
      console.log("WebSocket connected, initializing WebRTCManager.");

      const onStreamsChanged = (newStreams: Map<string, StreamInfo>) => {
        setStreams(newStreams);
      };

      const manager = new WebRTCManager(wsManager, onStreamsChanged);
      manager.connect();
      setRtcManager(manager);

      return () => {
        manager.close();
        setRtcManager(null);
      };
    }
  }, [isConnected, wsManager]);

  const { audioStreamCount, videoStreamCount } = useMemo(() => {
    const counts = { audioStreamCount: 0, videoStreamCount: 0 };
    for (const streamInfo of streams.values()) {
      if (streamInfo.type === "audio") {
        counts.audioStreamCount++;
      } else {
        counts.videoStreamCount++;
      }
    }
    return counts;
  }, [streams]);

  const value = {
    rtcManager,
    streams,
    audioStreamCount,
    videoStreamCount,
  };

  return (
    <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
  );
}
