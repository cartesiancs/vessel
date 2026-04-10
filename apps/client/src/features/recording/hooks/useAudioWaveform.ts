import { useState, useEffect, useRef } from "react";

interface UseAudioWaveformOptions {
  src: string;
  samples?: number;
}

interface UseAudioWaveformReturn {
  waveformData: number[];
  isLoading: boolean;
  error: Error | null;
}

export function useAudioWaveform({
  src,
  samples = 200,
}: UseAudioWaveformOptions): UseAudioWaveformReturn {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!src) {
      setWaveformData([]);
      return;
    }

    let cancelled = false;

    const generateWaveform = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch audio data
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        // Create or reuse AudioContext
        const audioContext =
          audioContextRef.current ?? new AudioContext();
        audioContextRef.current = audioContext;

        // Decode audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (cancelled) return;

        // Get channel data (use first channel or mix stereo)
        const channelData = audioBuffer.getChannelData(0);
        const secondChannel =
          audioBuffer.numberOfChannels > 1
            ? audioBuffer.getChannelData(1)
            : null;

        // Downsample by taking peak values in each segment
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];

        for (let i = 0; i < samples; i++) {
          const start = i * blockSize;
          let max = 0;

          for (let j = start; j < start + blockSize && j < channelData.length; j++) {
            let sample = Math.abs(channelData[j]);
            if (secondChannel) {
              sample = Math.max(sample, Math.abs(secondChannel[j]));
            }
            max = Math.max(max, sample);
          }

          waveform.push(max);
        }

        // Normalize to 0-1 range
        const maxVal = Math.max(...waveform, 0.001);
        const normalized = waveform.map((v) => v / maxVal);

        if (!cancelled) {
          setWaveformData(normalized);
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

    generateWaveform();

    return () => {
      cancelled = true;
    };
  }, [src, samples]);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    waveformData,
    isLoading,
    error,
  };
}
