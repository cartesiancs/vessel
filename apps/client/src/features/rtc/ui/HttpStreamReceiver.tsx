import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Button } from "@/shared/ui/button";
import { apiClient } from "@/shared/api";
import { storage } from "@/shared/lib/storage";

type HttpStreamReceiverProps = {
  topic: string;
  streamType: "audio" | "video";
};

type TokenResponse = {
  token: string;
  expires_in: number;
};

function buildPlaylistUrl(topic: string, token: string): string {
  const serverUrl = storage.getServerUrl() ?? "";
  const base = serverUrl ? `${serverUrl}/api` : "/api";
  const encodedTopic = encodeURIComponent(topic);
  return `${base}/streams/hls/${encodedTopic}/playlist.m3u8?token=${encodeURIComponent(token)}`;
}

export function HttpStreamReceiver({ topic, streamType }: HttpStreamReceiverProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  if (streamType === "audio") {
    return (
      <div className='w-full rounded-md bg-black/60 p-2 text-xs text-white/70'>
        Audio over HLS is not supported yet. Switch to WebRTC.
      </div>
    );
  }

  const attachStream = (url: string) => {
    const video = videoRef.current;
    if (!video) {
      setError("Video element not ready");
      return false;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        liveSyncDuration: 2,
        liveMaxLatencyDuration: 6,
        backBufferLength: 10,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error("[HLS] fatal error", data);
          setError(data.details ?? "Playback error");
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    } else {
      setError("HLS is not supported in this browser");
      return false;
    }

    video.play().catch((e) => console.error("HLS play failed:", e));
    return true;
  };

  const handlePlay = async () => {
    setLoading(true);
    setError(null);
    try {
      const encodedTopic = encodeURIComponent(topic);
      const { data } = await apiClient.post<TokenResponse>(
        `/streams/hls/${encodedTopic}/token`,
      );
      const url = buildPlaylistUrl(topic, data.token);

      setActive(true);
      // Wait one frame so React mounts the <video> element before we attach.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      if (!attachStream(url)) {
        setActive(false);
      }
    } catch (e) {
      console.error("Failed to start HLS stream:", e);
      setError(e instanceof Error ? e.message : "Failed to start stream");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex w-full flex-col gap-2'>
      {!active && (
        <Button
          className='w-full'
          variant='outline'
          onClick={handlePlay}
          disabled={loading}
        >
          {loading ? "Starting…" : "Play Video (HLS)"}
        </Button>
      )}
      <video
        ref={videoRef}
        className={`w-full bg-black ${active ? "" : "hidden"}`}
        autoPlay
        playsInline
        controls
        muted
      />
      {error && <span className='text-xs text-red-500'>{error}</span>}
    </div>
  );
}
