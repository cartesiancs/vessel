import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { Reconnector } from "../lib/reconnect";
import { WebSocketChannel, WebSocketMessage } from "../lib/ws";
import { isDemoMode } from "@/shared/config/demo";
import { MockWebSocketChannel } from "../lib/wsMock";

type WebSocketManager = WebSocketChannel | MockWebSocketChannel;

interface WebSocketContextState {
  wsManager: WebSocketManager;
  isConnected: boolean;
  sendMessage: (message: WebSocketMessage) => void;
}

const WebSocketContext = createContext<WebSocketContextState | undefined>(
  undefined,
);

export const WebSocketProvider: React.FC<{
  url: string;
  /**
   * Builds the URL for a reconnect. The signaling URL embeds a short-lived access token, so a
   * reconnect needs a fresh one rather than the original `url`.
   */
  resolveUrl?: () => Promise<string | null>;
  children: ReactNode;
}> = ({ url, resolveUrl, children }) => {
  const managerRef = useRef<WebSocketManager>(
    isDemoMode ? new MockWebSocketChannel() : new WebSocketChannel(),
  );
  const [isConnected, setIsConnected] = useState(
    managerRef.current.isConnected(),
  );

  useEffect(() => {
    const wsManager = managerRef.current;
    // Without this a dropped socket (server restart, network blip) stayed down until a reload,
    // and every WebRTC stream with it.
    const reconnector = new Reconnector(async () => {
      const next = resolveUrl ? await resolveUrl() : url;
      if (!next) {
        reconnector.onClose();
        return;
      }
      wsManager.connect(next);
    });

    wsManager.onopen = () => {
      console.log("Connected to WebSocket server");
      reconnector.onOpen();
      setIsConnected(true);
    };

    wsManager.onclose = () => {
      console.log("Disconnected from WebSocket server");
      setIsConnected(false);
      reconnector.onClose();
    };

    if (url && !wsManager.isConnected()) {
      wsManager.connect(url);
    }

    return () => {
      reconnector.stop();
      wsManager.onopen = null;
      wsManager.onclose = null;
      wsManager.close();
    };
  }, [url, resolveUrl]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    managerRef.current.send(message);
  }, []);

  const value = {
    wsManager: managerRef.current,
    isConnected,
    sendMessage,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketMessage = (
  callback: (msg: WebSocketMessage) => void,
) => {
  const { wsManager } = useWebSocket();

  useEffect(() => {
    if (wsManager && callback) {
      wsManager.addMessageListener(callback);

      return () => {
        wsManager.removeMessageListener(callback);
      };
    }
  }, [wsManager, callback]);
};

export const useWebSocket = (): WebSocketContextState => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};
