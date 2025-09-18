import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { WebSocketChannel, WebSocketMessage } from "../ws/ws";

export const wsManager = new WebSocketChannel();

interface WebSocketContextState {
  wsManager: WebSocketChannel;
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
  const [isConnected, setIsConnected] = useState(wsManager.isConnected());

  useEffect(() => {
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
    wsManager.send(message);
  }, []);

  const value = {
    wsManager,
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
