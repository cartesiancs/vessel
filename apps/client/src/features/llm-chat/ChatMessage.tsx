import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "./types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
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
            : "bg-muted text-foreground"
        )}
      >
        {/* Display image if present */}
        {message.image?.previewUrl && (
          <img
            src={message.image.previewUrl}
            alt={message.image.fileName || "Uploaded image"}
            className="max-w-full rounded mb-2"
          />
        )}

        {/* Text content */}
        <p className="whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && (
            <span className="animate-pulse ml-0.5">▊</span>
          )}
        </p>

        <span
          className={cn(
            "mt-1 block text-xs opacity-60",
            isUser ? "text-right" : "text-left"
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
