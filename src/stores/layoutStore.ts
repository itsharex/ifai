import { create } from 'zustand';

interface LayoutState {
  isChatOpen: boolean;
  setChatOpen: (isOpen: boolean) => void;
  toggleChat: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isChatOpen: true, // Default open
  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
}));
