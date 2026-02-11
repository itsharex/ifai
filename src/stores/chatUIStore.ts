import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatUIState {
  inputHistory: string[];
  historyIndex: number;
  
  // v0.3.6 UI Optimization
  isSearchVisible: boolean;
  densityMode: 'comfortable' | 'compact' | 'minimal';
  
  addToHistory: (command: string) => void;
  setHistoryIndex: (index: number) => void;
  resetHistoryIndex: () => void;
  getHistoryItem: (index: number) => string | null;
  
  // UI Actions
  setSearchVisible: (visible: boolean) => void;
  toggleSearch: () => void;
  setDensityMode: (mode: 'comfortable' | 'compact' | 'minimal') => void;
}

export const useChatUIStore = create<ChatUIState>()(
  persist(
    (set, get) => ({
      inputHistory: [],
      historyIndex: -1,
      isSearchVisible: false,
      densityMode: 'comfortable',

      addToHistory: (command) => {
        if (!command.trim()) return;
        const { inputHistory } = get();
        // Don't add if same as last entry
        if (inputHistory.length > 0 && inputHistory[0] === command) {
          set({ historyIndex: -1 });
          return;
        }
        
        set({
          inputHistory: [command, ...inputHistory].slice(0, 100),
          historyIndex: -1
        });
      },

      setHistoryIndex: (index) => set({ historyIndex: index }),
      
      resetHistoryIndex: () => set({ historyIndex: -1 }),

      getHistoryItem: (index) => {
        const { inputHistory } = get();
        if (index >= 0 && index < inputHistory.length) {
          return inputHistory[index];
        }
        return null;
      },

      setSearchVisible: (visible) => set({ isSearchVisible: visible }),
      toggleSearch: () => set((state) => ({ isSearchVisible: !state.isSearchVisible })),
      setDensityMode: (mode) => set({ densityMode: mode }),
    }),
    {
      name: 'chat-ui-storage',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        console.log(`[ChatUIStore] Migrating from version ${version} to 1`);
        return persistedState;
      },
    }
  )
);
