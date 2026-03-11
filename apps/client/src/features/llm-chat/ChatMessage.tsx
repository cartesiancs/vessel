import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "./types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "tool") return null;

  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {/* Display image if present */}
        {message.image?.previewUrl && (
          <img
            src={message.image.previewUrl}
            alt={message.image.fileName || "Uploaded image"}
            className='max-w-full rounded mb-2'
          />
        )}

        {/* Tool call in progress */}
        {message.isToolCalling && (
          <div className='mb-2 flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5 rounded bg-blue-500/10'>
            <LoaderCircle className='h-3.5 w-3.5 animate-spin text-blue-400' />
            <span className='text-blue-400'>Generating flow...</span>
          </div>
        )}

        {/* Tool call results */}
        {!message.isToolCalling &&
          message.toolResults &&
          message.toolResults.length > 0 && (
            <div className='mb-2 space-y-1'>
              {message.toolResults.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-1",
                    r.success
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400",
                  )}
                >
                  <span className='font-mono truncate w-50'>
                    {r.name} {r.message}
                  </span>
                </div>
              ))}
            </div>
          )}

        {/* Text content */}
        <p className='whitespace-pre-wrap break-words'>
          {message.content}
          {message.isStreaming && (
            <span className='animate-pulse ml-0.5'>▊</span>
          )}
        </p>

        <span
          className={cn(
            "mt-1 block text-xs opacity-60",
            isUser ? "text-right" : "text-left",
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
