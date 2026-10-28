import { create } from "zustand";
import { LlmClient, LlmHttpError, LlmNotConfiguredError } from "@/shared/lib/llm/client";
import type { HistoryMessage, ToolCallResult } from "@/shared/lib/llm/types";
import { storage } from "@/shared/lib/storage";
import type { ChatMessage, ChatPanelState } from "./types";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildHistory(messages: ChatMessage[]): HistoryMessage[] {
  return messages
    .filter((m) => !m.isStreaming && !m.content.startsWith("⚠️"))
    .map((m) => {
      const msg: HistoryMessage = { role: m.role, content: m.content };
      if (m.toolCalls) msg.tool_calls = m.toolCalls;
      if (m.toolCallId) msg.tool_call_id = m.toolCallId;
      return msg;
    });
}

// Settings are read per request, so changes in Settings -> AI apply immediately.
const llmClient = new LlmClient(() => storage.getLlmSettings());

function handleChatError(
  error: unknown,
  defaultMsg: string,
): { errorMessage: string; showInChat: boolean } {
  let errorMessage = defaultMsg;
  let showInChat = false;

  if (error instanceof LlmNotConfiguredError) {
    errorMessage = error.message;
    showInChat = true;
  } else if (
    error instanceof LlmHttpError &&
    (error.status === HTTP_UNAUTHORIZED || error.status === HTTP_FORBIDDEN)
  ) {
    errorMessage = "The AI endpoint rejected the request. Check the API key in Settings → AI.";
    showInChat = true;
  } else if (error instanceof LlmHttpError && error.status === HTTP_TOO_MANY_REQUESTS) {
    errorMessage = "The AI endpoint is rate limiting requests. Please try again later.";
    showInChat = true;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    showInChat = true;
  }

  return { errorMessage, showInChat };
}

export const useChatStore = create<ChatPanelState>((set, get) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  error: null,
  pendingImage: null,
  flowContext: null,

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  setFlowContext: (ctx) => set({ flowContext: ctx }),

  sendMessage: async (content: string) => {
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const history = buildHistory(get().messages.slice(0, -2));
      const flowCtx = get().flowContext;

      let receivedToolCalls: ToolCallResult[] | null = null;

      await llmClient.chatStream(content, (chunk, done) => {
        if (done) {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMessage.id ? { ...m, isStreaming: false } : m,
            ),
          }));
        } else {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: m.content + chunk }
                : m,
            ),
          }));
        }
      }, {
        history,
        ...(flowCtx && {
          systemPrompt: flowCtx.buildSystemPrompt(),
          tools: flowCtx.tools,
          toolChoice: "auto" as const,
          onToolCall: (toolCalls) => {
            receivedToolCalls = toolCalls;
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, isToolCalling: true, isStreaming: false }
                  : m,
              ),
            }));
          },
        }),
      });

      // Tool call feedback loop
      if (receivedToolCalls && flowCtx) {
        const toolResults = flowCtx.executeToolCalls(receivedToolCalls);

        // Store toolCalls on the assistant message for history reconstruction
        // and add tool result messages to the messages array
        const toolResultMessages: ChatMessage[] = toolResults.map((r) => ({
          id: generateId(),
          role: "tool" as const,
          content: JSON.stringify({ success: r.success, message: r.message }),
          toolCallId: r.toolCallId,
          timestamp: new Date(),
        }));

        const finalMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isStreaming: true,
        };

        set((state) => ({
          messages: [
            ...state.messages.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, isToolCalling: false, toolResults, toolCalls: receivedToolCalls ?? undefined }
                : m,
            ),
            ...toolResultMessages,
            finalMessage,
          ],
        }));

        const feedbackHistory = buildHistory(
          get().messages.slice(0, -1),
        );

        await llmClient.chatStream(
          "Based on the tool execution results above, briefly summarize what was done.",
          (chunk, done) => {
            if (done) {
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === finalMessage.id ? { ...m, isStreaming: false } : m,
                ),
                isLoading: false,
              }));
            } else {
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === finalMessage.id
                    ? { ...m, content: m.content + chunk }
                    : m,
                ),
              }));
            }
          },
          {
            history: feedbackHistory,
            systemPrompt: flowCtx.buildSystemPrompt(),
          },
        );
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      const { errorMessage, showInChat } = handleChatError(error, "Failed to send message");

      set({
        error: showInChat ? null : errorMessage,
        isLoading: false,
        messages: get().messages.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: showInChat ? `⚠️ ${errorMessage}` : m.content,
                isStreaming: false,
                isToolCalling: false,
              }
            : m,
        ),
      });
    }
  },

  sendMessageWithImage: async (content: string, image: File) => {
    const previewUrl = URL.createObjectURL(image);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
      image: {
        previewUrl,
        fileName: image.name,
        size: image.size,
      },
    };

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isLoading: true,
      error: null,
      pendingImage: null,
    }));

    try {
      const history = buildHistory(get().messages.slice(0, -2));
      await llmClient.analyzeImageStream(
        { image, message: content },
        (chunk, done) => {
          if (done) {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMessage.id ? { ...m, isStreaming: false } : m,
              ),
              isLoading: false,
            }));
          } else {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: m.content + chunk }
                  : m,
              ),
            }));
          }
        },
        { history },
      );
    } catch (error) {
      const { errorMessage, showInChat } = handleChatError(error, "Failed to analyze image");

      set((state) => ({
        error: showInChat ? null : errorMessage,
        isLoading: false,
        messages: state.messages.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: `⚠️ ${errorMessage}`, isStreaming: false }
            : m,
        ),
      }));
    }
  },

  setPendingImage: (image: File | null) => {
    set({ pendingImage: image });
  },

  clearMessages: () => {
    const messages = get().messages;
    messages.forEach((m) => {
      if (m.image?.previewUrl) {
        URL.revokeObjectURL(m.image.previewUrl);
      }
    });
    set({ messages: [], error: null });
  },
}));
