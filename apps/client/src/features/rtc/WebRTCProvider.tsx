import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useWebSocket } from "../ws/WebSocketProvider";
import { WebRTCManager } from "./rtc";

type WebRTCContextType = {
  rtcManager: WebRTCManager | null;
  streams: Map<string, MediaStream>;
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
  const [streams, setStreams] = useState<Map<string, MediaStream>>(new Map());

  useEffect(() => {
    if (isConnected && wsManager) {
      console.log("WebSocket connected, initializing WebRTCManager.");

      const onStreamsChanged = (newStreams: Map<string, MediaStream>) => {
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

  const value = { rtcManager, streams };

  return (
    <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
  );
}
