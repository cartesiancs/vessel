import type { Tool, ToolCallResult } from "@vessel/capsule-client";
import type { ToolExecutionResult } from "@/features/flow/flow-chat";

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
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** Attached image (only exists in user messages) */
  image?: ChatMessageImage;
  /** Tool call is currently being executed */
  isToolCalling?: boolean;
  /** Raw tool calls from LLM (for history reconstruction) */
  toolCalls?: ToolCallResult[];
  /** Tool call ID (for tool result messages in history) */
  toolCallId?: string;
  /** Tool call execution results (UI display only) */
  toolResults?: ToolExecutionResult[];
}

export interface FlowChatContext {
  buildSystemPrompt: () => string;
  tools: Tool[];
  executeToolCalls: (toolCalls: ToolCallResult[]) => ToolExecutionResult[];
}

export interface ChatPanelState {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  /** Selected image (before sending) */
  pendingImage: File | null;
  /** Flow context for tool calling (set when on flow page) */
  flowContext: FlowChatContext | null;

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
  /** Update the Capsule server URL at runtime */
  updateCapsuleUrl: (url: string) => void;
  /** Set flow context for tool calling */
  setFlowContext: (ctx: FlowChatContext | null) => void;
}
