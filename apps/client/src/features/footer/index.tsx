import { useState, useEffect, useCallback } from "react";
import { useWebSocket, useWebSocketMessage } from "../ws/WebSocketProvider";
import { WebSocketMessage } from "../ws/ws";

export function Footer() {
  const { wsManager } = useWebSocket();
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    if (!wsManager) return;

    const intervalId = setInterval(() => {
      wsManager.send({
        type: "ping",
        payload: { timestamp: Date.now() },
      });
    }, 10200);

    return () => {
      console.log("CLEARING INTERVAL");
      clearInterval(intervalId);
    };
  }, [wsManager]);

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    try {
      if (msg.type === "pong") {
        const latency =
          Date.now() - (msg.payload as { timestamp: number }).timestamp;
        setLatency(latency);
      }
    } catch (err) {
      console.error("Error handling signaling message:", err);
    }
  }, []);

  useWebSocketMessage(handleMessage);

  return (
    <div className='flex h-5 w-full bg-background z-[999] fixed border-t bottom-0 px-2 gap-2'>
      <b className='text-xs text-neutral-600 font-medium'>Vessel 0.1</b>
      <b className='text-xs text-neutral-600 font-medium'>{latency}ms</b>
    </div>
  );
}
