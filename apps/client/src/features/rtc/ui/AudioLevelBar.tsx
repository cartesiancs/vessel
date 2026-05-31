import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

type AudioLevelBarProps = {
  stream: MediaStream | null;
  className?: string;
};

export function AudioLevelBar({ stream, className }: AudioLevelBarProps) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const stopAnalyser = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (err) {
        console.error("Error disconnecting audio source", err);
      }
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (err) {
        console.error("Error disconnecting analyser", err);
      }
      analyserRef.current = null;
    }
  };

  useEffect(() => {
    stopAnalyser();

    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }

    let cancelled = false;

    const setupAnalyser = async () => {
      const audioContext =
        audioContextRef.current ??
        new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        try {
          await audioContext.resume();
        } catch (err) {
          console.error("Unable to resume AudioContext", err);
        }
      }

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.7;

      sourceNode.connect(analyserNode);
      analyserRef.current = analyserNode;
      sourceRef.current = sourceNode;

      const buffer = new Float32Array(analyserNode.fftSize);

      const updateLevel = () => {
        if (cancelled || !analyserRef.current) {
          return;
        }

        analyserRef.current.getFloatTimeDomainData(buffer);

        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) {
          const sample = buffer[i];
          sumSquares += sample * sample;
        }

        const rms = Math.sqrt(sumSquares / buffer.length) || 0;
        const db = 20 * Math.log10(rms || 1e-8);
        const minDb = -70;
        const normalized = Math.min(Math.max((db - minDb) / -minDb, 0), 1);

        setLevel(normalized);
        rafRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    };

    setupAnalyser();

    return () => {
      cancelled = true;
      stopAnalyser();
    };
  }, [stream]);

  useEffect(() => {
    return () => {
      stopAnalyser();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((err) => {
          console.error("Error closing AudioContext", err);
        });
        audioContextRef.current = null;
      }
    };
  }, []);

  return (
    <div className={cn("h-10 w-full overflow-hidden bg-black/50", className)}>
      <div
        className='h-full bg-white transition-[width] duration-75 ease-linear'
        style={{ width: `${Math.round(level * 100)}%` }}
      />
    </div>
  );
}
