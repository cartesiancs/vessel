import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useMemo,
} from "react";
import { useWebSocket } from "../../ws";
import { WebRTCManager, type StreamKind } from "../lib/rtc";
import { isDemoMode } from "@/shared/config/demo";
import { WebSocketChannel } from "../../ws";

// Host candidates only: viewers and server share a LAN, and Vessel makes no calls to external
// STUN/TURN services.
const LOCAL_ICE_SERVERS: RTCIceServer[] = [];

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
  const [demoMode] = useState(isDemoMode);
  // Outlives individual managers so a replacement can restore what the viewer subscribed to.
  const subscriptionsRef = useRef(new Map<string, StreamKind>());
  // Bumped when the peer connection fails, which replaces the manager.
  const [rtcGeneration, setRtcGeneration] = useState(0);

  // Create WebRTCManager when connected
  useEffect(() => {
    if (demoMode) {
      setRtcManager(null);
      setStreams(new Map());
      return;
    }

    if (isConnected && wsManager) {
      if (!(wsManager instanceof WebSocketChannel)) {
        setRtcManager(null);
        setStreams(new Map());
        return;
      }

      console.log("WebSocket connected, initializing WebRTCManager");

      const onStreamsChanged = (newStreams: Map<string, StreamInfo>) => {
        setStreams(newStreams);
      };

      const manager = new WebRTCManager(wsManager, onStreamsChanged, {
        iceServers: LOCAL_ICE_SERVERS,
        subscriptions: subscriptionsRef.current,
        onConnectionFailed: () => {
          console.warn("[WebRTC] Peer connection failed; reconnecting");
          setRtcGeneration((generation) => generation + 1);
        },
      });
      manager.connect();
      setRtcManager(manager);

      return () => {
        manager.close();
        setRtcManager(null);
      };
    }
  }, [demoMode, isConnected, wsManager, rtcGeneration]);

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

  const value = demoMode
    ? {
        rtcManager: null,
        streams: new Map(),
        audioStreamCount: 0,
        videoStreamCount: 0,
      }
    : {
        rtcManager,
        streams,
        audioStreamCount,
        videoStreamCount,
      };

  return (
    <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
  );
}
