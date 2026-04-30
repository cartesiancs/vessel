import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useWebRTC } from "../rtc/WebRTCProvider";
import { captureFrameFromStream } from "../rtc/captureFrame";
import { useChatStore } from "../llm-chat/store";
import { cn } from "@/lib/utils";

interface AnalyzeMenuItemProps {
  topic: string;
  className?: string;
}

export function AnalyzeMenuItem({ topic, className }: AnalyzeMenuItemProps) {
  const { streams } = useWebRTC();
  const { setPendingImage, openPanel } = useChatStore();
  const [isCapturing, setIsCapturing] = useState(false);

  const streamInfo = streams.get(topic);
  const hasStream = !!streamInfo?.stream;

  const handleClick = async () => {
    if (!streamInfo?.stream) return;

    setIsCapturing(true);
    try {
      const frameFile = await captureFrameFromStream(streamInfo.stream);
      setPendingImage(frameFile);
      openPanel();
    } catch (error) {
      console.error("Frame capture failed:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <DropdownMenuItem
      onClick={handleClick}
      disabled={!hasStream || isCapturing}
      className={cn("flex items-center gap-2", className)}
    >
      {isCapturing ? (
        <>
          <Loader2 className='h-4 w-4 animate-spin' />
          <span>Capturing...</span>
        </>
      ) : (
        <>
          <Eye className='h-4 w-4' />
          <span>Analyze Frame</span>
        </>
      )}
    </DropdownMenuItem>
  );
}
