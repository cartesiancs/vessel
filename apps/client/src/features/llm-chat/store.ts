import { create } from "zustand";
import {
  CapsuleClient,
  CapsuleAuthError,
  CapsuleSubscriptionError,
  CapsuleRateLimitError,
} from "@vessel/capsule-client";
import { supabase } from "@/lib/supabase";
import type { ChatMessage, ChatPanelState } from "./types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const CAPSULE_URL = import.meta.env.VITE_CAPSULE_URL || "http://localhost:3000";

// CapsuleClient singleton with Supabase token provider
const capsuleClient = new CapsuleClient({
  baseUrl: CAPSULE_URL,
  timeout: 120000, // Image analysis may take a long time
  getAccessToken: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  },
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
      await capsuleClient.chatStream(content, (chunk, done) => {
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
      });
    } catch (error) {
      let errorMessage = "Failed to send message";
      let showInChat = false;

      if (error instanceof CapsuleAuthError) {
        errorMessage = "Please sign in to continue.";
        showInChat = true;
      } else if (error instanceof CapsuleSubscriptionError) {
        errorMessage =
          "Pro subscription required. Upgrade at [vessel.cartesiancs.com/pricing](https://vessel.cartesiancs.com/pricing)";
        showInChat = true;
      } else if (error instanceof CapsuleRateLimitError) {
        errorMessage = "Daily usage limit reached. Please try again tomorrow.";
        showInChat = true;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({
        error: showInChat ? null : errorMessage,
        isLoading: false,
        messages: get().messages.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: showInChat ? `⚠️ ${errorMessage}` : m.content,
                isStreaming: false,
              }
            : m,
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
      await capsuleClient.analyzeImageStream(
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
      );
    } catch (error) {
      let errorMessage = "Failed to analyze image";
      let showInChat = false;

      if (error instanceof CapsuleAuthError) {
        errorMessage = "Please sign in to continue.";
        showInChat = true;
      } else if (error instanceof CapsuleSubscriptionError) {
        errorMessage =
          "Pro subscription required. Upgrade at [vessel.cartesiancs.com/pricing](https://vessel.cartesiancs.com/pricing)";
        showInChat = true;
      } else if (error instanceof CapsuleRateLimitError) {
        errorMessage = "Daily usage limit reached. Please try again tomorrow.";
        showInChat = true;
      } else if (error instanceof Error) {
        errorMessage = error.message;
        // Check for size limit error
        if (errorMessage.includes("length limit exceeded")) {
          errorMessage = "Image is too large. Please use an image under 20MB.";
        }
        showInChat = true;
      }

      // Show error in assistant message
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
