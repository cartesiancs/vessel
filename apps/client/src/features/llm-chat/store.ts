import { create } from "zustand";
import type { ChatMessage, ChatPanelState } from "./types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const mockResponses = [
  "Hello! How can I help you today?",
  "I understand. Could you please explain in more detail?",
  "Great question! You can find that feature in the settings page.",
  "Got it. Let me know if you need any further assistance.",
];

function getMockResponse(): string {
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

export const useChatStore = create<ChatPanelState>((set) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  error: null,

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

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      // Mock response (replace with actual API later)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: getMockResponse(),
        timestamp: new Date(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }));
    } catch {
      set({ error: "Failed to send message.", isLoading: false });
    }
  },

  clearMessages: () => set({ messages: [], error: null }),
}));
