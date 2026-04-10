import { useEffect, useRef, useCallback, useState } from "react";
import { storage } from "@/lib/storage";

const AUDIO_SAMPLE_RATE = 48000;
const BUFFER_SIZE = 4096;
const WATERFALL_HEIGHT = 200;
const FFT_SIZE = 2048;

// SDR-style waterfall color map: black → blue → cyan → green → yellow → red → white
function amplitudeToColor(value: number): [number, number, number] {
  // value: 0-255
  const v = value / 255;
  let r: number, g: number, b: number;

  if (v < 0.2) {
    // black → dark blue
    const t = v / 0.2;
    r = 0;
    g = 0;
    b = Math.floor(t * 180);
  } else if (v < 0.4) {
    // dark blue → cyan
    const t = (v - 0.2) / 0.2;
    r = 0;
    g = Math.floor(t * 255);
    b = 180 + Math.floor(t * 75);
  } else if (v < 0.6) {
    // cyan → green
    const t = (v - 0.4) / 0.2;
    r = 0;
    g = 255;
    b = Math.floor(255 * (1 - t));
  } else if (v < 0.8) {
    // green → yellow
    const t = (v - 0.6) / 0.2;
    r = Math.floor(t * 255);
    g = 255;
    b = 0;
  } else {
    // yellow → red → white
    const t = (v - 0.8) / 0.2;
    r = 255;
    g = Math.floor(255 * (1 - t * 0.6));
    b = Math.floor(t * 200);
  }

  return [r, g, b];
}

interface SdrAudioPlayerProps {
  isPlaying: boolean;
  onInfo?: (info: { samplerate: number; audio_rate: number }) => void;
  onError?: (error: string) => void;
  onDisconnect?: () => void;
}

export function SdrAudioPlayer({
  isPlaying,
  onInfo,
  onError,
  onDisconnect,
}: SdrAudioPlayerProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufferQueueRef = useRef<Int16Array[]>([]);
  const waterfallRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [level, setLevel] = useState(0);

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    bufferQueueRef.current = [];
    setLevel(0);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      cleanup();
      return;
    }

    const serverUrl = storage.getServerUrl();
    if (!serverUrl) {
      onError?.("Server URL not configured");
      return;
    }

    const wsUrl = serverUrl.replace(/^http/, "ws") + "/api/sdr/audio";
    const token = storage.getToken();
    const ws = new WebSocket(
      token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl,
    );
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    audioCtxRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.3;
    analyserRef.current = analyser;

    const scriptNode = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
    scriptNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      const queue = bufferQueueRef.current;

      let written = 0;
      while (written < output.length && queue.length > 0) {
        const chunk = queue[0];
        const remaining = output.length - written;
        const toWrite = Math.min(remaining, chunk.length);

        for (let i = 0; i < toWrite; i++) {
          output[written + i] = chunk[i] / 32768.0;
        }
        written += toWrite;

        if (toWrite >= chunk.length) {
          queue.shift();
        } else {
          queue[0] = chunk.slice(toWrite);
        }
      }

      for (let i = written; i < output.length; i++) {
        output[i] = 0;
      }
    };

    scriptNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    // Frequency data for waterfall
    const freqBins = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(freqBins);

    const drawWaterfall = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      setLevel(sum / dataArray.length / 255);

      // Draw waterfall
      const canvas = waterfallRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;

          // Scroll existing content down by 1 pixel
          const existing = ctx.getImageData(0, 0, w, h - 1);
          ctx.putImageData(existing, 0, 1);

          // Draw new FFT line at top row
          const lineData = ctx.createImageData(w, 1);
          const pixels = lineData.data;

          for (let x = 0; x < w; x++) {
            // Map canvas x position to frequency bin
            const binIndex = Math.floor((x / w) * freqBins);
            const value = dataArray[Math.min(binIndex, freqBins - 1)];
            const [r, g, b] = amplitudeToColor(value);
            const idx = x * 4;
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = 255;
          }

          ctx.putImageData(lineData, 0, 0);
        }
      }

      animFrameRef.current = requestAnimationFrame(drawWaterfall);
    };
    animFrameRef.current = requestAnimationFrame(drawWaterfall);

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);
        if (msg.type === "info") {
          onInfo?.({
            samplerate: msg.samplerate,
            audio_rate: msg.audio_rate,
          });
        } else if (msg.error) {
          onError?.(msg.error);
        }
        return;
      }

      // Binary: int16 PCM samples
      const pcmData = new Int16Array(event.data);
      bufferQueueRef.current.push(pcmData);

      // Prevent buffer from growing too large (drop oldest)
      while (bufferQueueRef.current.length > 20) {
        bufferQueueRef.current.shift();
      }
    };

    ws.onerror = () => {
      onError?.("WebSocket connection error");
    };

    ws.onclose = () => {
      onDisconnect?.();
    };

    return () => {
      scriptNode.disconnect();
      cleanup();
    };
  }, [isPlaying, cleanup, onInfo, onError, onDisconnect]);

  return (
    <div className="flex flex-col gap-2">
      {/* Waterfall display */}
      <div className="relative rounded overflow-hidden border border-border">
        <canvas
          ref={waterfallRef}
          width={800}
          height={WATERFALL_HEIGHT}
          className="w-full bg-black"
          style={{ height: `${WATERFALL_HEIGHT}px`, imageRendering: "pixelated" }}
        />
        {/* Frequency axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 py-0.5 text-[10px] text-white/60 bg-black/40">
          <span>0 Hz</span>
          <span>{AUDIO_SAMPLE_RATE / 4 / 1000} kHz</span>
          <span>{AUDIO_SAMPLE_RATE / 2 / 1000} kHz</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Level: {(level * 100).toFixed(0)}%
      </div>
    </div>
  );
}
