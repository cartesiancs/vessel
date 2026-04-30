import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TrashIcon, MessageSquareIcon } from "lucide-react";
import { useChatStore } from "./store";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";

export function ChatPanelMobile() {
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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquareIcon className="size-5 text-muted-foreground" />
            <SheetTitle>AI Assistant</SheetTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            disabled={messages.length === 0}
            title="Clear conversation"
          >
            <TrashIcon className="size-4" />
          </Button>
        </SheetHeader>

        <ChatMessages messages={messages} isLoading={isLoading} />

        <ChatInput
          onSend={sendMessage}
          onSendWithImage={sendMessageWithImage}
          pendingImage={pendingImage}
          onImageSelect={setPendingImage}
          disabled={isLoading}
        />
      </SheetContent>
    </Sheet>
  );
}
