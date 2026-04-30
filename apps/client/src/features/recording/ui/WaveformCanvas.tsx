import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import { cn } from "@/lib/utils";

interface WaveformCanvasProps {
  waveformData: number[];
  width: number;
  height: number;
  progress: number;
  playedColor?: string;
  unplayedColor?: string;
  rulerColor?: string;
  onSeek?: (progress: number) => void;
  className?: string;
}

export function WaveformCanvas({
  waveformData,
  width,
  height,
  progress,
  playedColor = "rgba(255, 255, 255, 1)",
  unplayedColor = "rgba(255, 255, 255, 0.3)",
  rulerColor = "#ef4444",
  onSeek,
  className,
}: WaveformCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newProgress = Math.max(0, Math.min(1, x / rect.width));
      onSeek(newProgress);
    },
    [onSeek],
  );

  useEffect(() => {
    if (!svgRef.current || !waveformData.length || width <= 0 || height <= 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const midY = height / 2;
    const barWidth = Math.max(1, width / waveformData.length - 1);

    // Create scales
    const xScale = d3
      .scaleLinear()
      .domain([0, waveformData.length - 1])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([0, midY - 2]);

    // Define clip path for played portion
    const clipId = `waveform-clip-${Math.random().toString(36).slice(2)}`;
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", progress * width)
      .attr("height", height);

    // Draw unplayed waveform (background)
    const unplayedGroup = svg.append("g").attr("fill", unplayedColor);

    waveformData.forEach((value, i) => {
      const x = xScale(i);
      const barHeight = yScale(value);

      // Top bar (mirrored)
      unplayedGroup
        .append("rect")
        .attr("x", x)
        .attr("y", midY - barHeight)
        .attr("width", barWidth)
        .attr("height", barHeight)
        .attr("rx", barWidth / 2);

      // Bottom bar
      unplayedGroup
        .append("rect")
        .attr("x", x)
        .attr("y", midY)
        .attr("width", barWidth)
        .attr("height", barHeight)
        .attr("rx", barWidth / 2);
    });

    // Draw played waveform (foreground with clip)
    const playedGroup = svg
      .append("g")
      .attr("fill", playedColor)
      .attr("clip-path", `url(#${clipId})`);

    waveformData.forEach((value, i) => {
      const x = xScale(i);
      const barHeight = yScale(value);

      // Top bar (mirrored)
      playedGroup
        .append("rect")
        .attr("x", x)
        .attr("y", midY - barHeight)
        .attr("width", barWidth)
        .attr("height", barHeight)
        .attr("rx", barWidth / 2);

      // Bottom bar
      playedGroup
        .append("rect")
        .attr("x", x)
        .attr("y", midY)
        .attr("width", barWidth)
        .attr("height", barHeight)
        .attr("rx", barWidth / 2);
    });

    // Draw center line
    svg
      .append("line")
      .attr("x1", 0)
      .attr("y1", midY)
      .attr("x2", width)
      .attr("y2", midY)
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.1)
      .attr("stroke-width", 1);

    // Draw red ruler (playhead)
    const rulerX = progress * width;
    svg
      .append("line")
      .attr("x1", rulerX)
      .attr("y1", 0)
      .attr("x2", rulerX)
      .attr("y2", height)
      .attr("stroke", rulerColor)
      .attr("stroke-width", 2);

    // Draw ruler handle (triangle at top)
    svg
      .append("polygon")
      .attr("points", `${rulerX - 6},0 ${rulerX + 6},0 ${rulerX},8`)
      .attr("fill", rulerColor);
  }, [
    waveformData,
    width,
    height,
    progress,
    playedColor,
    unplayedColor,
    rulerColor,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("relative cursor-pointer", className)}
      onClick={handleClick}
      style={{ width, height }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className='absolute top-0 left-0'
      />
    </div>
  );
}
