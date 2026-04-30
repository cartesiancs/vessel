import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useMemo,
} from "react";
import { toast } from "sonner";
import { useWebSocket } from "../../ws";
import { WebRTCManager } from "../lib/rtc";
import { isDemoMode } from "@/shared/config/demo";
import { WebSocketChannel } from "../../ws";
import {
  ensureIceServers,
  onCredentialChange,
  onTurnCredentialError,
  stopAutoRenewal,
  DEFAULT_ICE_SERVERS,
} from "../lib/turnService";

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
  const [iceServers, setIceServers] = useState<RTCIceServer[] | null>(null);
  const lastTurnErrorRef = useRef<string | null>(null);

  // Load ICE servers: try localStorage → server DB → Supabase → STUN fallback
  useEffect(() => {
    if (demoMode) {
      setIceServers(DEFAULT_ICE_SERVERS);
      return;
    }

    let cancelled = false;

    ensureIceServers().then((servers) => {
      if (!cancelled) setIceServers(servers);
    });

    const unsubscribe = onCredentialChange((servers) => {
      if (!cancelled) setIceServers(servers);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      stopAutoRenewal();
    };
  }, [demoMode, isConnected]);

  useEffect(() => {
    if (demoMode) return;

    return onTurnCredentialError((error) => {
      const fingerprint = `${error.code}:${error.message}:${error.usage?.periodEnd ?? ""}`;
      if (lastTurnErrorRef.current === fingerprint) return;

      lastTurnErrorRef.current = fingerprint;

      if (error.code === "TURN_QUOTA_EXCEEDED") {
        toast.error("TURN relay quota exceeded", {
          description:
            error.usage?.periodEnd
              ? `1 GB monthly limit reached. Quota resets ${new Date(
                  error.usage.periodEnd,
                ).toLocaleString()}.`
              : "1 GB monthly limit reached for TURN relay traffic.",
        });
        return;
      }

      if (error.code === "TURN_USAGE_UNAVAILABLE") {
        toast.error("TURN usage check unavailable", {
          description: "TURN relay usage could not be verified, so the app is using STUN only.",
        });
      }
    });
  }, [demoMode]);

  // Create WebRTCManager when connected and ICE servers are ready
  useEffect(() => {
    if (demoMode) {
      setRtcManager(null);
      setStreams(new Map());
      return;
    }

    if (isConnected && wsManager && iceServers) {
      if (!(wsManager instanceof WebSocketChannel)) {
        setRtcManager(null);
        setStreams(new Map());
        return;
      }

      console.log(
        "WebSocket connected, initializing WebRTCManager with",
        iceServers.length,
        "ICE servers:",
        iceServers.map((s) => ({
          urls: s.urls,
          hasCredentials: !!s.username,
        })),
      );

      const onStreamsChanged = (newStreams: Map<string, StreamInfo>) => {
        setStreams(newStreams);
      };

      const manager = new WebRTCManager(wsManager, onStreamsChanged, {
        iceServers,
      });
      manager.connect();
      setRtcManager(manager);

      return () => {
        manager.close();
        setRtcManager(null);
      };
    }
  }, [demoMode, isConnected, wsManager, iceServers]);

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
