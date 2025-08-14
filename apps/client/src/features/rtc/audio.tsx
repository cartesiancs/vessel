import { useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { WebRTCManager } from "./rtc";
import { useWebSocket } from "../ws/WebSocketProvider";

export default function AudioReceiver() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { wsManager, isConnected } = useWebSocket();

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) {
      console.error("Authentication token not found.");
      return;
    }

    if (wsManager && token && isConnected) {
      const manager = new WebRTCManager(audioRef, wsManager);

      manager.subscribe("go_stream_1");
      manager.createAndSendOffer();

      setInterval(() => {
        manager.sendHealthCheck();
      }, 10000);

      return () => {
        manager.close();
      };
    }
  }, [wsManager, isConnected]);

  return <audio ref={audioRef} autoPlay playsInline controls />;
}
