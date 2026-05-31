import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from "react";
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
  children: ReactNode;
}> = ({ url, children }) => {
  const managerRef = useRef<WebSocketManager>(
    isDemoMode ? new MockWebSocketChannel() : new WebSocketChannel(),
  );
  const [isConnected, setIsConnected] = useState(
    managerRef.current.isConnected(),
  );

  useEffect(() => {
    const wsManager = managerRef.current;

    wsManager.onopen = () => {
      console.log("Connected to WebSocket server");
      setIsConnected(true);
    };

    wsManager.onclose = () => {
      console.log("Disconnected from WebSocket server");
      setIsConnected(false);
    };

    if (url && !wsManager.isConnected()) {
      wsManager.connect(url);
    }

    return () => {
      wsManager.onopen = null;
      wsManager.onclose = null;
      wsManager.close();
    };
  }, [url]);

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
