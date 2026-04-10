import { useEffect, useState } from "react";
import { Circle, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordingStore } from "@/entities/recording/store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface RecordingButtonProps {
  topic: string;
  className?: string;
}

export function RecordingButton({ topic, className }: RecordingButtonProps) {
  const {
    isRecording,
    getActiveRecordingId,
    startRecording,
    stopRecording,
    fetchActiveRecordings,
  } = useRecordingStore();

  const [isLoading, setIsLoading] = useState(false);
  const recording = isRecording(topic);
  const recordingId = getActiveRecordingId(topic);

  useEffect(() => {
    fetchActiveRecordings();
  }, [fetchActiveRecordings]);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (recording && recordingId) {
        await stopRecording(recordingId);
      } else {
        await startRecording(topic);
      }
    } catch (error) {
      console.error("Recording action failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={recording ? "destructive" : "outline"}
            size='icon'
            onClick={handleClick}
            disabled={isLoading}
            className={cn("relative h-8 w-8", className)}
          >
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : recording ? (
              <>
                <Square className='h-4 w-4' />
                <span className='absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse' />
              </>
            ) : (
              <Circle className='h-4 w-4 fill-red-500 text-red-500' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{recording ? "Stop Recording" : "Start Recording"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RecordingMenuItem({ topic, className }: RecordingButtonProps) {
  const {
    isRecording,
    getActiveRecordingId,
    startRecording,
    stopRecording,
    fetchActiveRecordings,
  } = useRecordingStore();

  const [isLoading, setIsLoading] = useState(false);
  const recording = isRecording(topic);
  const recordingId = getActiveRecordingId(topic);

  useEffect(() => {
    fetchActiveRecordings();
  }, [fetchActiveRecordings]);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (recording && recordingId) {
        await stopRecording(recordingId);
      } else {
        await startRecording(topic);
      }
    } catch (error) {
      console.error("Recording action failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenuItem
      onClick={handleClick}
      disabled={isLoading}
      className={cn("flex items-center gap-2", className)}
    >
      {isLoading ? (
        <Loader2 className='h-4 w-4 animate-spin' />
      ) : recording ? (
        <>
          <Square className='h-4 w-4' />
          <span>Stop Recording</span>
          <span className='ml-auto h-2 w-2 rounded-full bg-red-500 animate-pulse' />
        </>
      ) : (
        <>
          <Circle className='h-4 w-4 fill-red-500 text-red-500' />
          <span>Start Recording</span>
        </>
      )}
    </DropdownMenuItem>
  );
}
