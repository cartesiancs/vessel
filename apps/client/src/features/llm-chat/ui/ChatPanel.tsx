import { Button } from "@/components/ui/button";
import { XIcon, TrashIcon } from "lucide-react";
import { isElectron } from "@/lib/electron";
import { cn } from "@/lib/utils";
import { useChatStore } from "./store";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";

const PANEL_WIDTH = 400;
const ELECTRON_TOP_OFFSET = 34;

export function ChatPanel() {
  const {
    isOpen,
    messages,
    isLoading,
    pendingImage,
    closePanel,
    sendMessage,
    sendMessageWithImage,
    setPendingImage,
    clearMessages,
  } = useChatStore();

  const topOffset = isElectron() ? ELECTRON_TOP_OFFSET : 0;

  return (
    <div
      className={cn(
        "fixed right-0 z-40 flex flex-col border-l bg-background shadow-lg transition-transform duration-300 ease-in-out",
        !isOpen && "translate-x-full",
      )}
      style={{
        top: topOffset,
        height: `calc(100vh - ${topOffset}px)`,
        width: PANEL_WIDTH,
      }}
    >
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 h-[48px]'>
        <div className='flex items-center gap-2'>
          <h2 className='font-semibold'>Assistant</h2>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='icon'
            onClick={clearMessages}
            disabled={messages.length === 0}
            title='Clear conversation'
          >
            <TrashIcon className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={closePanel}
            title='Close panel (⌘K)'
          >
            <XIcon className='size-4' />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ChatMessages messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onSendWithImage={sendMessageWithImage}
        pendingImage={pendingImage}
        onImageSelect={setPendingImage}
        disabled={isLoading}
      />
    </div>
  );
}

export { PANEL_WIDTH };
