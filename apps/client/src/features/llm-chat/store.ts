import { create } from "zustand";
import { EnclaveClient } from "@vessel/enclave-client";
import type { ChatMessage, ChatPanelState } from "./types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const ENCLAVE_URL = import.meta.env.VITE_ENCLAVE_URL || "http://localhost:3000";

// EnclaveClient singleton
const enclaveClient = new EnclaveClient({
  baseUrl: ENCLAVE_URL,
  timeout: 120000, // Image analysis may take a long time
});

export const useChatStore = create<ChatPanelState>((set, get) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  error: null,
  pendingImage: null,

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  sendMessage: async (content: string) => {
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    // Empty assistant message for streaming response
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
      await enclaveClient.chatStream(content, (chunk, done) => {
        if (done) {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
            ),
            isLoading: false,
          }));
        } else {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: m.content + chunk }
                : m
            ),
          }));
        }
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to send message",
        isLoading: false,
        messages: get().messages.map((m) =>
          m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
        ),
      });
    }
  },

  sendMessageWithImage: async (content: string, image: File) => {
    // Create Object URL (for preview)
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
      pendingImage: null, // Reset image selection
    }));

    try {
      // Send encrypted image (streaming)
      await enclaveClient.analyzeImageStream(
        { image, message: content },
        (chunk, done) => {
          if (done) {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
              ),
              isLoading: false,
            }));
          } else {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: m.content + chunk }
                  : m
              ),
            }));
          }
        }
      );
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to analyze image",
        isLoading: false,
        messages: get().messages.map((m) =>
          m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
        ),
      });
    }
  },

  setPendingImage: (image: File | null) => {
    set({ pendingImage: image });
  },

  clearMessages: () => {
    // Revoke Object URLs of existing messages (prevent memory leak)
    const messages = get().messages;
    messages.forEach((m) => {
      if (m.image?.previewUrl) {
        URL.revokeObjectURL(m.image.previewUrl);
      }
    });
    set({ messages: [], error: null });
  },
}));
