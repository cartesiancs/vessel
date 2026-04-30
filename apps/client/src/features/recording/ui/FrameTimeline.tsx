import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Frame {
  timeMs: number;
  dataUrl: string;
}

interface FrameTimelineProps {
  frames: Frame[];
  isLoading: boolean;
  progress: number;
  durationMs: number;
  onSeek?: (progress: number) => void;
  className?: string;
}

export function FrameTimeline({
  frames,
  isLoading,
  progress,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  durationMs,
  onSeek,
  className,
}: FrameTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateProgress = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onSeek) return;
      setIsDragging(true);
      onSeek(calculateProgress(e.clientX));
    },
    [onSeek, calculateProgress],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !onSeek) return;
      onSeek(calculateProgress(e.clientX));
    },
    [isDragging, onSeek, calculateProgress],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!onSeek) return;
      setIsDragging(true);
      onSeek(calculateProgress(e.touches[0].clientX));
    },
    [onSeek, calculateProgress],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || !onSeek) return;
      onSeek(calculateProgress(e.touches[0].clientX));
    },
    [isDragging, onSeek, calculateProgress],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (isLoading) {
    return (
      <div className={cn("flex gap-1 overflow-hidden", className)}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className='h-12 flex-1 min-w-[40px]' />
        ))}
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div
        className={cn(
          "h-12 bg-muted/30 rounded flex items-center justify-center text-muted-foreground text-sm",
          className,
        )}
      >
        No frames available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-12 bg-black/20 rounded overflow-hidden cursor-pointer select-none",
        className,
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Frame thumbnails */}
      <div className='flex h-full'>
        {frames.map((frame, i) => (
          <div
            key={i}
            className='flex-1 min-w-0 h-full border-r border-black/20 last:border-r-0'
          >
            <img
              src={frame.dataUrl}
              alt={`Frame at ${formatTime(frame.timeMs)}`}
              className='w-full h-full object-cover'
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Progress overlay (darkens unplayed portion) */}
      <div
        className='absolute top-0 right-0 h-full bg-black/50 pointer-events-none transition-[left] duration-75'
        style={{ left: `${progress * 100}%` }}
      />

      {/* Progress handle */}
      <div
        className='absolute top-0 h-full w-1 bg-primary pointer-events-none'
        style={{ left: `calc(${progress * 100}% - 2px)` }}
      >
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-md' />
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
