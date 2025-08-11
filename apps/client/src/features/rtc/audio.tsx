import { useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { WebRTCManager } from "./rtc";

export default function AudioReceiver() {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) {
      console.error("Authentication token not found.");
      return;
    }

    const manager = new WebRTCManager(audioRef);

    const handleConnect = () => {
      console.log("WebSocket connected.");
      manager.subscribe("go_stream_1");
      manager.createAndSendOffer();

      setInterval(() => {
        manager.sendHealthCheck();
      }, 10000);
    };

    manager.connect("ws://127.0.0.1:8080/signal?token=" + token, handleConnect);

    return () => {
      console.log("Cleaning up WebRTC manager.");
      manager.close();
    };
  }, []);

  return <audio ref={audioRef} autoPlay playsInline controls />;
}
