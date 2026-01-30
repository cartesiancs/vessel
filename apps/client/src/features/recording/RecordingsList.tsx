import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Play, Trash2, Loader2, RefreshCw, Square } from "lucide-react";
import { useRecordingStore } from "@/entities/recording/store";
import { VideoPlaybackDialog } from "./VideoPlaybackDialog";
import { formatSimpleDateTime } from "@/lib/time";
import type { Recording } from "@/entities/recording/types";

export function RecordingsList() {
  const {
    recordings,
    isLoading,
    fetchRecordings,
    deleteRecording,
    stopRecording,
  } = useRecordingStore();

  const [selectedRecording, setSelectedRecording] = useState<number | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteRecording(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStopRecording = async (id: number) => {
    try {
      await stopRecording(id);
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "recording":
        return (
          <Badge variant="destructive" className="animate-pulse">
            Recording
          </Badge>
        );
      case "failed":
        return <Badge variant="secondary">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recording History</CardTitle>
          <CardDescription>View and manage your stream recordings</CardDescription>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchRecordings()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && recordings.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recordings yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recorded At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordings.map((recording) => (
                <RecordingRow
                  key={recording.id}
                  recording={recording}
                  onPlay={() => setSelectedRecording(recording.id)}
                  onDelete={() => handleDelete(recording.id)}
                  onStop={() => handleStopRecording(recording.id)}
                  isDeleting={deletingId === recording.id}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <VideoPlaybackDialog
        recordingId={selectedRecording}
        open={selectedRecording !== null}
        onClose={() => setSelectedRecording(null)}
      />
    </Card>
  );
}

interface RecordingRowProps {
  recording: Recording;
  onPlay: () => void;
  onDelete: () => void;
  onStop: () => void;
  isDeleting: boolean;
  getStatusBadge: (status: string) => React.ReactNode;
}

function RecordingRow({
  recording,
  onPlay,
  onDelete,
  onStop,
  isDeleting,
  getStatusBadge,
}: RecordingRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium max-w-[200px] truncate">
        {recording.topic}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{recording.media_type}</Badge>
      </TableCell>
      <TableCell>{formatDuration(recording.duration_ms)}</TableCell>
      <TableCell>{formatFileSize(recording.file_size)}</TableCell>
      <TableCell>{getStatusBadge(recording.status)}</TableCell>
      <TableCell>{formatSimpleDateTime(recording.started_at)}</TableCell>
      <TableCell className="text-right">
        <div className="flex gap-2 justify-end">
          {recording.status === "recording" ? (
            <Button variant="destructive" size="icon" onClick={onStop}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPlay}
              disabled={recording.status !== "completed"}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isDeleting || recording.status === "recording"}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Recording</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this recording? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

function formatDuration(ms: number): string {
  if (ms === 0) return "-";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
