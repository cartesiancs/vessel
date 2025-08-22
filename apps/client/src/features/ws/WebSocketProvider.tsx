import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { WebSocketChannel, WebSocketMessage } from "../ws/ws";

interface WebSocketContextState {
  wsManager: WebSocketChannel | null;
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
  const [isConnected, setIsConnected] = useState(false);
  const wsManagerRef = useRef<WebSocketChannel | null>(null);

  useEffect(() => {
    if (url) {
      const wsManager = new WebSocketChannel();
      wsManagerRef.current = wsManager;

      wsManager.onopen = () => {
        console.log("Connected to WebSocket server");
        setIsConnected(true);
      };

      wsManager.onclose = () => {
        console.log("Disconnected from WebSocket server");
        setIsConnected(false);
      };

      wsManager.connect(url);

      return () => {
        wsManager.close();
      };
    }
  }, [url]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    wsManagerRef.current?.send(message);
  }, []);

  const value = {
    wsManager: wsManagerRef.current,
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
