import { useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { WebRTCManager } from "./rtc";

export default function AudioReceiver() {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const token = Cookies.get("token");

    if (!token) {
      return;
    }

    const manager = new WebRTCManager(audioRef);
    manager.connect("ws://127.0.0.1:8080/signal?token=" + token);

    return () => {
      manager.close();
    };
  }, []);

  return <audio ref={audioRef} autoPlay playsInline />;
}
