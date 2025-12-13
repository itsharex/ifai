import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatState } from './chatStore';

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isLoading: false,
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      updateMessageContent: (id, content) => set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === id ? { ...msg, content } : msg
        ),
      })),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({ apiKey: state.apiKey }), // Only persist API Key
    }
  )
);
