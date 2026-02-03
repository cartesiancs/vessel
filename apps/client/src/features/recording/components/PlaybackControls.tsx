import { Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  className?: string;
}

export function PlaybackControls({
  isPlaying,
  currentTimeMs,
  durationMs,
  onPlay,
  onPause,
  onStop,
  className,
}: PlaybackControlsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant='ghost'
        size='icon'
        onClick={isPlaying ? onPause : onPlay}
        className='h-8 w-8'
      >
        {isPlaying ? (
          <Pause className='h-4 w-4' />
        ) : (
          <Play className='h-4 w-4' />
        )}
      </Button>
      <Button
        variant='ghost'
        size='icon'
        onClick={onStop}
        className='h-8 w-8'
      >
        <Square className='h-4 w-4' />
      </Button>
      <span className='text-sm text-muted-foreground ml-2'>
        {formatTime(currentTimeMs)} / {formatTime(durationMs)}
      </span>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
