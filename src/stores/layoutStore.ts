import { create } from 'zustand';

interface LayoutState {
  isChatOpen: boolean;
  isCommandPaletteOpen: boolean;
  isTerminalOpen: boolean;
  setChatOpen: (isOpen: boolean) => void;
  toggleChat: () => void;
  setCommandPaletteOpen: (isOpen: boolean) => void;
  toggleCommandPalette: () => void;
  setTerminalOpen: (isOpen: boolean) => void;
  toggleTerminal: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isChatOpen: true, // Default open
  isCommandPaletteOpen: false,
  isTerminalOpen: false,
  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  setCommandPaletteOpen: (isOpen) => set({ isCommandPaletteOpen: isOpen }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  setTerminalOpen: (isOpen) => set({ isTerminalOpen: isOpen }),
  toggleTerminal: () => set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
}));
