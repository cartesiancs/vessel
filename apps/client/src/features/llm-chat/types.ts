export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatPanelState {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}
