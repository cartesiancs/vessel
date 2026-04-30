import { useState, useEffect, useRef } from "react";

interface Frame {
  timeMs: number;
  dataUrl: string;
}

interface UseVideoFramesOptions {
  src: string;
  durationMs: number;
  frameCount: number;
  frameHeight?: number;
}

interface UseVideoFramesReturn {
  frames: Frame[];
  isLoading: boolean;
  error: Error | null;
}

export function useVideoFrames({
  src,
  durationMs,
  frameCount,
  frameHeight = 48,
}: UseVideoFramesOptions): UseVideoFramesReturn {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!src || durationMs <= 0 || frameCount <= 0) {
      setFrames([]);
      return;
    }

    let cancelled = false;

    const extractFrames = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Create offscreen video element
        const video = document.createElement("video");
        video.src = src;
        video.crossOrigin = "anonymous";
        video.preload = "metadata";
        videoRef.current = video;

        // Wait for video metadata to load
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () =>
            reject(new Error("Failed to load video metadata"));
          video.load();
        });

        if (cancelled) return;

        // Create canvas for frame capture
        const aspectRatio = video.videoWidth / video.videoHeight;
        const canvas = document.createElement("canvas");
        canvas.height = frameHeight;
        canvas.width = Math.round(frameHeight * aspectRatio);
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        const extractedFrames: Frame[] = [];
        const interval = durationMs / (frameCount + 1);

        for (let i = 1; i <= frameCount; i++) {
          if (cancelled) break;

          const timeMs = interval * i;
          video.currentTime = timeMs / 1000;

          // Wait for seek to complete
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              resolve();
            };
            video.addEventListener("seeked", onSeeked);
          });

          if (cancelled) break;

          // Capture frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

          extractedFrames.push({
            timeMs,
            dataUrl,
          });
        }

        if (!cancelled) {
          setFrames(extractedFrames);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    extractFrames();

    return () => {
      cancelled = true;
      if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current = null;
      }
    };
  }, [src, durationMs, frameCount, frameHeight]);

  return {
    frames,
    isLoading,
    error,
  };
}
