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
      <b className='text-xs text-neutral-600 font-medium'>
        <TokenExpiration />
      </b>
      <b className='text-xs font-medium'>
        <WebSocketStatusIndicator />
      </b>
    </div>
  );
}

import Cookies from "js-cookie";
import { WebSocketStatusIndicator } from "../ws/IsConnected";
import { parseJwt } from "@/lib/jwt";
import { isDemoMode } from "@/shared/demo";

const TokenExpiration: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const token = Cookies.get("token");

      if (!token || isDemoMode) {
        setTimeLeft("");
        return;
      }

      const decodedToken = parseJwt(token);

      if (!decodedToken || typeof decodedToken.exp !== "number") {
        setTimeLeft("");
        return;
      }

      const expirationTime = decodedToken.exp * 1000;
      const currentTime = new Date().getTime();
      const remainingTime = expirationTime - currentTime;

      if (remainingTime <= 0) {
        setTimeLeft("");
        return;
      }

      const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((remainingTime / (1000 * 60)) % 60);
      const seconds = Math.floor((remainingTime / 1000) % 60);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s left`);
    };

    calculateTimeLeft();
    const intervalId = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return <div>{timeLeft}</div>;
};
