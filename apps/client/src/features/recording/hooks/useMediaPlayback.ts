import { useState, useEffect, useCallback, RefObject } from "react";

interface UseMediaPlaybackReturn {
  isPlaying: boolean;
  currentTime: number; // ms
  duration: number; // ms
  progress: number; // 0-1
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeMs: number) => void;
}

export function useMediaPlayback(
  mediaRef: RefObject<HTMLMediaElement | null>
): UseMediaPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime * 1000);
    };

    const handleDurationChange = () => {
      setDuration(media.duration * 1000);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleLoadedMetadata = () => {
      setDuration(media.duration * 1000);
    };

    media.addEventListener("timeupdate", handleTimeUpdate);
    media.addEventListener("durationchange", handleDurationChange);
    media.addEventListener("loadedmetadata", handleLoadedMetadata);
    media.addEventListener("play", handlePlay);
    media.addEventListener("pause", handlePause);
    media.addEventListener("ended", handleEnded);

    // Initialize duration if already loaded
    if (media.duration && !isNaN(media.duration)) {
      setDuration(media.duration * 1000);
    }

    return () => {
      media.removeEventListener("timeupdate", handleTimeUpdate);
      media.removeEventListener("durationchange", handleDurationChange);
      media.removeEventListener("loadedmetadata", handleLoadedMetadata);
      media.removeEventListener("play", handlePlay);
      media.removeEventListener("pause", handlePause);
      media.removeEventListener("ended", handleEnded);
    };
  }, [mediaRef]);

  const play = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      media.play().catch((err) => {
        console.error("Error playing media:", err);
      });
    }
  }, [mediaRef]);

  const pause = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      media.pause();
    }
  }, [mediaRef]);

  const stop = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      media.pause();
      media.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [mediaRef]);

  const seek = useCallback(
    (timeMs: number) => {
      const media = mediaRef.current;
      if (media) {
        const clampedTime = Math.max(0, Math.min(timeMs, duration));
        media.currentTime = clampedTime / 1000;
        setCurrentTime(clampedTime);
      }
    },
    [mediaRef, duration]
  );

  const progress = duration > 0 ? currentTime / duration : 0;

  return {
    isPlaying,
    currentTime,
    duration,
    progress,
    play,
    pause,
    stop,
    seek,
  };
}
