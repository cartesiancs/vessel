import { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "./WebRTCProvider";

type StreamReceiverProps = {
  topic: string;
  streamType: "audio" | "video";
};

export function StreamReceiver({ topic, streamType }: StreamReceiverProps) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const { rtcManager, streams } = useWebRTC();
  const [isSubscribed, setIsSubscribed] = useState(false);

  const stream = useMemo(() => {
    return streams.get(topic) || null;
  }, [streams, topic]);

  useEffect(() => {
    if (stream && mediaRef.current) {
      mediaRef.current.srcObject = stream;
      mediaRef.current
        .play()
        .catch((e) => console.error("Media play failed:", e));
    }
  }, [stream]);

  const handleSubscribe = () => {
    if (rtcManager) {
      rtcManager.subscribe(topic);
      setIsSubscribed(true);
    } else {
      console.error("RTCManager is not ready.");
    }
  };

  if (!isSubscribed) {
    return (
      <Button className='w-full' variant={"outline"} onClick={handleSubscribe}>
        {streamType === "audio" ? "Play Audio" : "Play Video"}
      </Button>
    );
  }

  if (streamType == "video") {
    return (
      <video
        ref={mediaRef}
        className='w-full bg-black rounded-md'
        autoPlay
        playsInline
        controls
      />
    );
  }

  if (streamType == "audio") {
    return (
      <audio ref={mediaRef} className='w-full' autoPlay playsInline controls />
    );
  }
}
