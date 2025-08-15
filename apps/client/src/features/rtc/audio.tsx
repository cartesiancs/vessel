import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { WebRTCManager } from "./rtc";
import { useWebSocket } from "../ws/WebSocketProvider";
import { Button } from "@/components/ui/button";

export default function AudioReceiver({ topic }: { topic: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { wsManager, isConnected } = useWebSocket();
  const [isSubscribe, setIsSubscribe] = useState(false);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) {
      console.error("Authentication token not found.");
      return;
    }

    if (wsManager && token && isConnected && isSubscribe) {
      const manager = new WebRTCManager(audioRef, wsManager);

      manager.subscribe(topic);
      manager.createAndSendOffer();

      setInterval(() => {
        manager.sendHealthCheck();
      }, 10000);

      return () => {
        manager.close();
      };
    }
  }, [wsManager, isConnected, isSubscribe]);

  return (
    <>
      {isSubscribe ? (
        <audio ref={audioRef} className='w-30' autoPlay playsInline controls />
      ) : (
        <Button
          className='w-full'
          variant={"outline"}
          onClick={() => setIsSubscribe(true)}
        >
          Play
        </Button>
      )}
    </>
  );
}
