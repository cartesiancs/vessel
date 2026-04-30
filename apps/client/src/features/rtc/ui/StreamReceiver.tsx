import { useEffect, useRef, useMemo } from "react";
import { Button } from "@/shared/ui/button";
import { useWebRTC } from "./WebRTCProvider";
import { WebRTCManager } from "../lib/rtc";
import { AudioLevelBar } from "./AudioLevelBar";

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
        className='w-full bg-black'
        autoPlay
        playsInline
        controls
        muted
      />
    );
  }

  if (streamType === "audio") {
    return (
      <div className='flex w-full flex-col gap-3 rounded-md bg-black/60 p-1'>
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          className='w-full hidden'
          autoPlay
          playsInline
          controls
        />
        <AudioLevelBar stream={stream} />
      </div>
    );
  }

  return null;
}
