import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { PromptTemplate } from '../types/prompt';

interface PromptState {
  prompts: PromptTemplate[];
  selectedPrompt: PromptTemplate | null;
  isLoading: boolean;
  error: string | null;

  loadPrompts: () => Promise<void>;
  selectPrompt: (path: string) => Promise<void>;
  updatePrompt: (path: string, content: string) => Promise<void>;
  renderTemplate: (content: string, variables: Record<string, string>) => Promise<string>;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  selectedPrompt: null,
  isLoading: false,
  error: null,

  loadPrompts: async () => {
    set({ isLoading: true, error: null });
    try {
      const prompts = await invoke<PromptTemplate[]>('list_prompts');
      set({ prompts, isLoading: false });
    } catch (err) {
      console.error('Failed to load prompts:', err);
      set({ error: String(err), isLoading: false });
    }
  },

  selectPrompt: async (path: string) => {
    const prompt = get().prompts.find(p => p.path === path);
    if (prompt) {
        set({ selectedPrompt: prompt });
    } else {
        try {
            const fetched = await invoke<PromptTemplate>('get_prompt', { path });
            set({ selectedPrompt: fetched });
        } catch (err) {
            console.error('Failed to select prompt:', err);
            set({ error: String(err) });
        }
    }
  },

  updatePrompt: async (path: string, content: string) => {
      try {
          await invoke('update_prompt', { path, content });
          
          // Refresh list to ensure metadata is updated
          await get().loadPrompts();
          
          // Update selected prompt content immediately for better UX
          const selected = get().selectedPrompt;
          if (selected && selected.path === path) {
             // We need to be careful not to overwrite user's work if they are typing fast
             // But updatePrompt is usually called on save.
             // Let's refetch to get updated metadata
             const updated = await invoke<PromptTemplate>('get_prompt', { path });
             set({ selectedPrompt: updated });
          }
      } catch (err) {
          console.error('Failed to update prompt:', err);
          set({ error: String(err) });
          throw err;
      }
  },
  
  renderTemplate: async (content: string, variables: Record<string, string>) => {
      try {
        return await invoke<string>('render_prompt_template', { content, variables });
      } catch (err) {
          console.error('Render error:', err);
          return `Error rendering template: ${err}`;
      }
  }
}));
