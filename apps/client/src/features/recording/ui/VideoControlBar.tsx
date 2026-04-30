import { useRef, useState, useEffect, useCallback, RefObject } from "react";
import { cn } from "@/shared/lib/utils";
import { useMediaPlayback } from "../model/useMediaPlayback";
import { useVideoFrames } from "../model/useVideoFrames";
import { PlaybackControls } from "./PlaybackControls";
import { FrameTimeline } from "./FrameTimeline";
import { TimeRuler } from "./TimeRuler";

interface VideoControlBarProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  durationMs: number;
  src: string;
  className?: string;
  frameCount?: number;
}

export function VideoControlBar({
  videoRef,
  durationMs,
  src,
  className,
  frameCount = 10,
}: VideoControlBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const playback = useMediaPlayback(videoRef);
  const { frames, isLoading } = useVideoFrames({
    src,
    durationMs,
    frameCount,
  });

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleSeek = useCallback(
    (progress: number) => {
      const effectiveDuration = playback.duration || durationMs;
      playback.seek(progress * effectiveDuration);
    },
    [playback, durationMs],
  );

  const handleTimeSeek = useCallback(
    (timeMs: number) => {
      playback.seek(timeMs);
    },
    [playback],
  );

  const effectiveDuration = playback.duration || durationMs;

  return (
    <div
      ref={containerRef}
      className={cn("w-full space-y-2 p-2 bg-black/80 rounded-lg", className)}
    >
      {/* Playback Controls */}
      <PlaybackControls
        isPlaying={playback.isPlaying}
        currentTimeMs={playback.currentTime}
        durationMs={effectiveDuration}
        onPlay={playback.play}
        onPause={playback.pause}
        onStop={playback.stop}
        className='text-white'
      />

      {/* Frame Timeline */}
      <FrameTimeline
        frames={frames}
        isLoading={isLoading}
        progress={playback.progress}
        durationMs={effectiveDuration}
        onSeek={handleSeek}
      />

      {/* Time Ruler */}
      <TimeRuler
        durationMs={effectiveDuration}
        currentTimeMs={playback.currentTime}
        width={containerWidth - 16}
        onSeek={handleTimeSeek}
        className='text-white/80'
      />
    </div>
  );
}
