import { useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "./WebRTCProvider";
import { WebRTCManager } from "./rtc";

type StreamReceiverProps = {
  topic: string;
  streamType: "audio" | "video";
};

export function StreamReceiver({ topic, streamType }: StreamReceiverProps) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const { rtcManager, streams, audioStreamCount, videoStreamCount } =
    useWebRTC();

  const streamInfo = useMemo(() => {
    return streams.get(topic) || null;
  }, [streams, topic]);

  const stream = streamInfo?.stream || null;

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
      rtcManager.subscribe(topic, streamType);
    } else {
      console.error("RTCManager is not ready.");
    }
  };

  const isLimitReached =
    (streamType === "audio" &&
      audioStreamCount >= WebRTCManager.MAX_AUDIO_STREAMS) ||
    (streamType === "video" &&
      videoStreamCount >= WebRTCManager.MAX_VIDEO_STREAMS);

  if (!stream) {
    return (
      <Button
        className='w-full'
        variant={"outline"}
        onClick={handleSubscribe}
        disabled={isLimitReached}
      >
        {streamType === "audio" ? "Play Audio" : "Play Video"}
        {isLimitReached && " (Limited)"}
      </Button>
    );
  }

  if (streamType === "video") {
    return (
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        className='w-full bg-black rounded-md'
        autoPlay
        playsInline
        controls
        muted
      />
    );
  }

  if (streamType === "audio") {
    return (
      <audio
        ref={mediaRef as React.RefObject<HTMLAudioElement>}
        className='w-full'
        autoPlay
        playsInline
        controls
      />
    );
  }

  return null;
}
