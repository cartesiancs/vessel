import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { WebRTCManager } from "./rtc";
import { useWebSocket } from "../ws/WebSocketProvider";
import { Button } from "@/components/ui/button";

type StreamReceiverProps = {
  topic: string;
  streamType: "audio" | "video";
};

export function AudioStreamReceiver({
  topic,
  streamType,
}: StreamReceiverProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { wsManager, isConnected } = useWebSocket();
  const [isSubscribe, setIsSubscribe] = useState(false);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token || !wsManager || !isConnected || !isSubscribe) {
      return;
    }

    const manager = new WebRTCManager(audioRef, wsManager, streamType);

    manager.subscribe(topic);
    manager.createAndSendOffer();

    const healthCheckInterval = setInterval(() => {
      manager.sendHealthCheck();
    }, 10000);

    return () => {
      clearInterval(healthCheckInterval);
      manager.close();
    };
  }, [wsManager, isConnected, isSubscribe, topic, streamType]);

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
          {streamType === "audio" ? "Play Audio" : "Play Video"}
        </Button>
      )}
    </>
  );
}
