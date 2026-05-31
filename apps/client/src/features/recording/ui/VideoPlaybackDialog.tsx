import { useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useRecordingStore } from "@/entities/recording";
import { getRecordingStreamUrl } from "@/entities/recording";
import { storage } from "@/shared/lib/storage";
import { AudioWaveformPlayer } from "./AudioWaveformPlayer";
import { VideoControlBar } from "./VideoControlBar";

interface VideoPlaybackDialogProps {
  recordingId: number | null;
  open: boolean;
  onClose: () => void;
}

export function VideoPlaybackDialog({
  recordingId,
  open,
  onClose,
}: VideoPlaybackDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { recordings } = useRecordingStore();
  const recording = recordings.find((r) => r.id === recordingId);

  const serverUrl = storage.getServerUrl() || "";
  const token = storage.getToken() || "";

  const streamUrl = recordingId
    ? getRecordingStreamUrl(recordingId, serverUrl, token)
    : null;

  const isAudioOnly = recording?.media_type === "audio";

  useEffect(() => {
    if (open && videoRef.current && streamUrl && !isAudioOnly) {
      videoRef.current.load();
    }
  }, [open, streamUrl, isAudioOnly]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle className='truncate max-w-sm'>
            {recording?.topic || "Recording Playback"}
          </DialogTitle>
        </DialogHeader>

        {streamUrl ? (
          isAudioOnly ? (
            <AudioWaveformPlayer
              src={streamUrl}
              durationMs={recording?.duration_ms || 0}
              className='py-2'
            />
          ) : (
            <div className='space-y-2'>
              <div className='aspect-video bg-black rounded-lg overflow-hidden'>
                <video
                  ref={videoRef}
                  src={streamUrl}
                  className='w-full h-full'
                />
              </div>
              <VideoControlBar
                videoRef={videoRef}
                durationMs={recording?.duration_ms || 0}
                src={streamUrl}
              />
            </div>
          )
        ) : (
          <div className='aspect-video bg-black rounded-lg overflow-hidden'>
            <div className='w-full h-full flex items-center justify-center text-muted-foreground'>
              No recording selected
            </div>
          </div>
        )}

        {recording && (
          <div className='text-sm text-muted-foreground space-y-1'>
            <p>Duration: {formatDuration(recording.duration_ms)}</p>
            <p>Size: {formatFileSize(recording.file_size)}</p>
            <p>Type: {recording.media_type}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
