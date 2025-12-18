import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface KeyBinding {
  id: string;
  commandId: string;
  keys: string; // e.g. "Mod+s", "Mod+Shift+p"
  label: string;
  description?: string;
  category?: string;
}

export interface ShortcutState {
  keybindings: KeyBinding[];
  
  // Actions
  registerShortcut: (binding: KeyBinding) => void;
  updateShortcut: (id: string, newKeys: string) => string | boolean;
  resetShortcuts: () => void;
  getKeybinding: (commandId: string) => string | undefined;
  hasConflict: (keys: string, excludeId?: string) => string | undefined; // Returns id of conflicting shortcut or undefined
}

const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  { id: 'file.save', commandId: 'file.save', keys: 'Mod+s', label: 'Save File', category: 'File' },
  { id: 'editor.find', commandId: 'editor.find', keys: 'Mod+f', label: 'Find', category: 'Editor' },
  { id: 'view.toggleChat', commandId: 'view.toggleChat', keys: 'Mod+l', label: 'Toggle Chat', category: 'View' },
  { id: 'view.commandPalette', commandId: 'view.commandPalette', keys: 'Mod+p', label: 'Command Palette', category: 'View' },
  { id: 'view.toggleTerminal', commandId: 'view.toggleTerminal', keys: 'Mod+j', label: 'Toggle Terminal', category: 'View' },
  { id: 'layout.splitVertical', commandId: 'layout.splitVertical', keys: 'Mod+Shift+\\', label: 'Split Vertical', category: 'Layout' },
  { id: 'layout.splitHorizontal', commandId: 'layout.splitHorizontal', keys: 'Mod+\\', label: 'Split Horizontal', category: 'Layout' },
  { id: 'layout.closePane', commandId: 'layout.closePane', keys: 'Mod+w', label: 'Close Pane', category: 'Layout' },
  { id: 'layout.focusPane1', commandId: 'layout.focusPane1', keys: 'Mod+1', label: 'Focus Pane 1', category: 'Layout' },
  { id: 'layout.focusPane2', commandId: 'layout.focusPane2', keys: 'Mod+2', label: 'Focus Pane 2', category: 'Layout' },
  { id: 'layout.focusPane3', commandId: 'layout.focusPane3', keys: 'Mod+3', label: 'Focus Pane 3', category: 'Layout' },
  { id: 'layout.focusPane4', commandId: 'layout.focusPane4', keys: 'Mod+4', label: 'Focus Pane 4', category: 'Layout' },
];

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      keybindings: DEFAULT_KEYBINDINGS,

      registerShortcut: (binding) => set((state) => {
        if (state.keybindings.find(k => k.id === binding.id)) return state;
        return { keybindings: [...state.keybindings, binding] };
      }),

      updateShortcut: (id, newKeys) => {
        const conflictingId = get().hasConflict(newKeys, id);
        if (conflictingId) {
          return conflictingId; // Return the ID of the conflicting shortcut
        }

        set((state) => ({
          keybindings: state.keybindings.map(kb => 
            kb.id === id ? { ...kb, keys: newKeys } : kb
          )
        }));
        return true; // Indicate success
      },
      resetShortcuts: () => set({ keybindings: DEFAULT_KEYBINDINGS }),

      getKeybinding: (commandId) => {
        return get().keybindings.find(kb => kb.commandId === commandId)?.keys;
      },

      hasConflict: (keys: string, excludeId?: string) => {
        const normalizedKeys = keys.toLowerCase();
        return get().keybindings.find(kb => 
          kb.id !== excludeId && kb.keys.toLowerCase() === normalizedKeys
        )?.id;
      }
    }),
    {
      name: 'shortcut-storage',
    }
  )
);