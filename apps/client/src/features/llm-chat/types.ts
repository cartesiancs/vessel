export interface ChatMessageImage {
  /** Object URL for local preview (revoke after use) */
  previewUrl?: string;
  /** Image file name */
  fileName?: string;
  /** Image size (bytes) */
  size?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** Attached image (only exists in user messages) */
  image?: ChatMessageImage;
}

export interface ChatPanelState {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  /** Selected image (before sending) */
  pendingImage: File | null;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  /** Send text message */
  sendMessage: (content: string) => Promise<void>;
  /** Send message with image */
  sendMessageWithImage: (content: string, image: File) => Promise<void>;
  /** Select image */
  setPendingImage: (image: File | null) => void;
  clearMessages: () => void;
}
