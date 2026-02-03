import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaPlayback } from "../hooks/useMediaPlayback";
import { useAudioWaveform } from "../hooks/useAudioWaveform";
import { PlaybackControls } from "./PlaybackControls";
import { WaveformCanvas } from "./WaveformCanvas";
import { TimeRuler } from "./TimeRuler";

interface AudioWaveformPlayerProps {
  src: string;
  durationMs: number;
  className?: string;
  autoPlay?: boolean;
}

export function AudioWaveformPlayer({
  src,
  durationMs,
  className,
  autoPlay = false,
}: AudioWaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { waveformData, isLoading, error } = useAudioWaveform({ src });
  const playback = useMediaPlayback(audioRef);

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

  // Auto-play on mount if enabled
  useEffect(() => {
    if (autoPlay && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [autoPlay]);

  const handleSeek = useCallback(
    (progress: number) => {
      const effectiveDuration = playback.duration || durationMs;
      playback.seek(progress * effectiveDuration);
    },
    [playback, durationMs]
  );

  const handleTimeSeek = useCallback(
    (timeMs: number) => {
      playback.seek(timeMs);
    },
    [playback]
  );

  const effectiveDuration = playback.duration || durationMs;

  return (
    <div
      ref={containerRef}
      className={cn("w-full space-y-3", className)}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload='metadata'
      />

      {/* Playback Controls */}
      <PlaybackControls
        isPlaying={playback.isPlaying}
        currentTimeMs={playback.currentTime}
        durationMs={effectiveDuration}
        onPlay={playback.play}
        onPause={playback.pause}
        onStop={playback.stop}
      />

      {/* Waveform */}
      <div className='bg-black rounded-lg p-2'>
        {isLoading ? (
          <Skeleton className='w-full h-24 bg-white/10' />
        ) : error ? (
          <div className='w-full h-24 flex items-center justify-center text-white/50 text-sm'>
            Failed to load waveform
          </div>
        ) : (
          <WaveformCanvas
            waveformData={waveformData}
            width={containerWidth - 16}
            height={96}
            progress={playback.progress}
            onSeek={handleSeek}
          />
        )}
      </div>

      {/* Time Ruler */}
      <TimeRuler
        durationMs={effectiveDuration}
        currentTimeMs={playback.currentTime}
        width={containerWidth}
        onSeek={handleTimeSeek}
        className='rounded'
      />
    </div>
  );
}
