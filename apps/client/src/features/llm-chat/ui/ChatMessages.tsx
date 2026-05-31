import { useEffect, useRef } from "react";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessage as ChatMessageType } from "../model/types";

interface ChatMessagesProps {
  messages: ChatMessageType[];
  isLoading?: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className='flex-1 px-4'>
      <div className='flex flex-col gap-3 py-4'>
        {messages.length === 0 ? (
          <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
            <p>Type a message to start the conversation.</p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        {isLoading && (
          <div className='flex justify-start'>
            <div className='bg-muted rounded-lg px-3 py-2'>
              <div className='flex gap-1'>
                <span className='size-2 animate-bounce rounded-full bg-foreground/40' />
                <span className='size-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:0.1s]' />
                <span className='size-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:0.2s]' />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
