import { useRef, useCallback, useMemo } from "react";
import { cn } from "@/shared/lib/utils";

interface TimeRulerProps {
  durationMs: number;
  currentTimeMs: number;
  width: number;
  height?: number;
  onSeek?: (timeMs: number) => void;
  className?: string;
}

export function TimeRuler({
  durationMs,
  currentTimeMs,
  width,
  height = 24,
  onSeek,
  className,
}: TimeRulerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek || !containerRef.current || durationMs <= 0) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const progress = Math.max(0, Math.min(1, x / rect.width));
      onSeek(progress * durationMs);
    },
    [onSeek, durationMs]
  );

  const ticks = useMemo(() => {
    if (durationMs <= 0 || width <= 0) return [];

    const result: Array<{
      timeMs: number;
      x: number;
      isMajor: boolean;
      label: string;
    }> = [];

    // Calculate appropriate tick interval based on duration
    let majorInterval: number;
    let minorInterval: number;

    if (durationMs <= 30000) {
      // <= 30 seconds
      majorInterval = 10000;
      minorInterval = 2000;
    } else if (durationMs <= 120000) {
      // <= 2 minutes
      majorInterval = 30000;
      minorInterval = 10000;
    } else if (durationMs <= 600000) {
      // <= 10 minutes
      majorInterval = 60000;
      minorInterval = 15000;
    } else {
      // > 10 minutes
      majorInterval = 300000;
      minorInterval = 60000;
    }

    for (let t = 0; t <= durationMs; t += minorInterval) {
      const isMajor = t % majorInterval === 0;
      const x = (t / durationMs) * width;

      result.push({
        timeMs: t,
        x,
        isMajor,
        label: isMajor ? formatRulerTime(t) : "",
      });
    }

    return result;
  }, [durationMs, width]);

  const progressX = durationMs > 0 ? (currentTimeMs / durationMs) * width : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-muted/30 select-none cursor-pointer",
        className
      )}
      style={{ height, width: width || "100%" }}
      onClick={handleClick}
    >
      {/* Tick marks */}
      <svg
        width={width}
        height={height}
        className='absolute top-0 left-0'
      >
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={tick.x}
              y1={0}
              x2={tick.x}
              y2={tick.isMajor ? 8 : 4}
              stroke='currentColor'
              strokeOpacity={tick.isMajor ? 0.5 : 0.3}
              strokeWidth={1}
            />
            {tick.label && (
              <text
                x={tick.x + 2}
                y={height - 4}
                fontSize={10}
                fill='currentColor'
                fillOpacity={0.6}
              >
                {tick.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Current time indicator */}
      <div
        className='absolute top-0 w-0.5 h-full bg-primary'
        style={{ left: progressX }}
      />
    </div>
  );
}

function formatRulerTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
